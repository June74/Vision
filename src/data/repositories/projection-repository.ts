/** Persists crash-recoverable, ciphertext-only full-list generations before atomic projection activation. */
import { sql } from "drizzle-orm";
import {
  encodeBase64Url,
  parseCipherEnvelope,
  serializeCipherEnvelope,
  type CipherEnvelope,
} from "../../crypto/envelope";
import type { KeyProvider } from "../../crypto/key-provider";
import {
  decryptProtectedFields,
  encryptProtectedFields,
} from "../../crypto/protected-fields";
import {
  ProviderEventChangeSchema,
  type ProviderEventChange,
  type ProviderEventProtectedPayload,
} from "../../domain/sync/change";
import type { VisionDatabase } from "../db";

const PROVIDER = "google-calendar";
/** Nonactivated rebuild ciphertext is retained long enough for delayed Queue retries, then becomes purgeable. */
export const PROJECTION_REBUILD_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
/** One maintenance pass is bounded so cleanup cannot monopolize the scheduled Worker. */
export const PROJECTION_REBUILD_CLEANUP_BATCH_SIZE = 100;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

/** Durable generation identity and checkpoint authority captured before provider paging begins. */
export interface BeginProjectionRebuild {
  readonly generationId: string;
  readonly ownerId: string;
  readonly calendarId: string;
  readonly jobId: string;
  readonly baseCheckpointVersion: number;
  readonly queueClaimId?: string;
  readonly now: Date;
}

/** Safe rebuild row state used to reconcile a retry without exposing staged content. */
export type BeginProjectionRebuildResult =
  | { readonly outcome: "staging"; readonly generationId: string }
  | { readonly outcome: "activated"; readonly generationId: string };

/** Owner-scoped durable staging boundary used by the invalid-token rebuild job. */
export interface ProjectionRepository {
  beginRebuild(input: BeginProjectionRebuild): Promise<BeginProjectionRebuildResult>;
  stageChanges(
    generationId: string,
    ordinalStart: number,
    changes: readonly ProviderEventChange[],
  ): Promise<void>;
  markReady(generationId: string, pageCount: number, now: Date): Promise<boolean>;
  loadStagedChanges(generationId: string): Promise<readonly ProviderEventChange[]>;
  abandon(generationId: string, now: Date): Promise<void>;
  cleanupExpired(now: Date): Promise<number>;
}

interface GenerationRow extends Record<string, unknown> {
  status: unknown;
}

interface StagedRow extends Record<string, unknown> {
  identityHash: unknown;
  planningJson: unknown;
  protectedPayloadEnvelope: unknown;
  protectedKeyVersion: unknown;
}

interface CleanupRow extends Record<string, unknown> {
  removedCount: unknown;
}

/** PostgreSQL implementation that never stores provider protected content outside an authenticated envelope. */
class EncryptedProjectionRepository implements ProjectionRepository {
  /** Captures one authenticated owner for every generation and stage lookup. */
  constructor(
    private readonly database: VisionDatabase,
    private readonly keyProvider: KeyProvider,
    private readonly ownerId: string,
  ) {
    requireBoundedText(ownerId, 128);
  }

  /** Creates an isolated staging generation or reports that the exact generation already activated. */
  async beginRebuild(
    input: BeginProjectionRebuild,
  ): Promise<BeginProjectionRebuildResult> {
    this.assertOwner(input.ownerId);
    validateBegin(input);
    const existing = await this.database.execute<GenerationRow>(sql`
      select status
      from projection_rebuild_generations
      where id = ${input.generationId}
        and owner_id = ${input.ownerId}
        and provider = ${PROVIDER}
        and provider_calendar_id = ${input.calendarId}
        and job_id = ${input.jobId}
        and base_checkpoint_version = ${input.baseCheckpointVersion}
        and queue_claim_id is not distinct from ${input.queueClaimId ?? null}
      limit 1
    `);
    if (existing.rows[0]?.status === "activated") {
      return { outcome: "activated", generationId: input.generationId };
    }
    // A queue retry owns the same job under a fresh claim/generation. Only non-activated predecessor state is
    // disposable; an activated row remains immutable evidence and is reconciled from sync_runs by the job repository.
    await this.database.execute(sql`
      delete from projection_rebuild_generations
      where owner_id = ${input.ownerId}
        and provider = ${PROVIDER}
        and provider_calendar_id = ${input.calendarId}
        and job_id = ${input.jobId}
        and status in ('staging', 'ready', 'abandoned')
    `);
    await this.database.execute(sql`
      insert into projection_rebuild_generations (
        id, owner_id, provider, provider_calendar_id, job_id,
        queue_claim_id, base_checkpoint_version, status,
        page_count, created_at, updated_at, activated_at
      ) values (
        ${input.generationId}, ${input.ownerId}, ${PROVIDER},
        ${input.calendarId}, ${input.jobId}, ${input.queueClaimId ?? null},
        ${input.baseCheckpointVersion}, 'staging', null,
        ${input.now}, ${input.now}, null
      )
    `);
    return { outcome: "staging", generationId: input.generationId };
  }

  /** Encrypts protected content and persists only bounded planning facts plus opaque identity digests. */
  async stageChanges(
    generationId: string,
    ordinalStart: number,
    changes: readonly ProviderEventChange[],
  ): Promise<void> {
    requireBoundedText(generationId, 128);
    if (!Number.isSafeInteger(ordinalStart) || ordinalStart < 0) {
      throw new Error("Projection rebuild ordinal is invalid.");
    }
    for (let index = 0; index < changes.length; index += 1) {
      const change = ProviderEventChangeSchema.parse(changes[index]);
      const identity = change.type === "upsert" ? change.identity : change.target;
      const identityHash = await digestIdentity(identity);
      const planning =
        change.type === "delete"
          ? change
          : {
              type: change.type,
              identity: change.identity,
              startsAt: change.startsAt,
              endsAt: change.endsAt,
              timeZone: change.timeZone,
              busy: change.busy,
              status: change.status,
              recurrence: change.recurrence,
            };
      let protectedEnvelope: Uint8Array | null = null;
      let protectedKeyVersion: number | null = null;
      if (change.type === "upsert") {
        const encrypted = await encryptProtectedFields(
          this.keyProvider,
          stageContext(this.ownerId, generationId, identityHash),
          { protectedPayload: JSON.stringify(change.protected) },
        );
        if (encrypted.protectedPayload === null) {
          throw new Error("Projection rebuild payload encryption failed.");
        }
        protectedEnvelope = encodeEnvelope(encrypted.protectedPayload);
        protectedKeyVersion = encrypted.protectedPayload.keyVersion;
      }
      const serializedPlanning = JSON.stringify(planning);
      await this.database.execute(sql`
        insert into projection_rebuild_changes (
          generation_id, identity_hash, ordinal, planning_json,
          protected_payload_envelope, protected_key_version
        )
        select
          ${generationId}, ${identityHash}, ${ordinalStart + index},
          ${serializedPlanning}::jsonb, ${protectedEnvelope}::bytea,
          ${protectedKeyVersion}
        from projection_rebuild_generations generation
        where generation.id = ${generationId}
          and generation.owner_id = ${this.ownerId}
          and generation.provider = ${PROVIDER}
          and generation.status = 'staging'
      `);
    }
  }

  /** Seals a complete generation only after the terminal provider page supplies a new cursor. */
  async markReady(
    generationId: string,
    pageCount: number,
    now: Date,
  ): Promise<boolean> {
    requireBoundedText(generationId, 128);
    if (!Number.isSafeInteger(pageCount) || pageCount <= 0) {
      throw new Error("Projection rebuild page count is invalid.");
    }
    const result = await this.database.execute<Record<string, unknown>>(sql`
      update projection_rebuild_generations
      set status = 'ready', page_count = ${pageCount}, updated_at = ${now}
      where id = ${generationId}
        and owner_id = ${this.ownerId}
        and provider = ${PROVIDER}
        and status = 'staging'
      returning id
    `);
    return result.rows.length === 1;
  }

  /** Authenticates every staged payload and reconstructs the closed provider-neutral change contract. */
  async loadStagedChanges(
    generationId: string,
  ): Promise<readonly ProviderEventChange[]> {
    requireBoundedText(generationId, 128);
    const result = await this.database.execute<StagedRow>(sql`
      select
        change.identity_hash as "identityHash",
        change.planning_json as "planningJson",
        change.protected_payload_envelope as "protectedPayloadEnvelope",
        change.protected_key_version as "protectedKeyVersion"
      from projection_rebuild_changes change
      inner join projection_rebuild_generations generation
        on generation.id = change.generation_id
      where change.generation_id = ${generationId}
        and generation.owner_id = ${this.ownerId}
        and generation.provider = ${PROVIDER}
        and generation.status = 'ready'
      order by change.ordinal
    `);
    const decoded: ProviderEventChange[] = [];
    for (const row of result.rows) {
      const planning = readJsonObject(row.planningJson);
      if (planning.type === "delete") {
        decoded.push(ProviderEventChangeSchema.parse(planning));
        continue;
      }
      const identityHash = readDigest(row.identityHash);
      const envelope = decodeEnvelope(readBytes(row.protectedPayloadEnvelope));
      const keyVersion = readPositiveInteger(row.protectedKeyVersion);
      if (envelope.keyVersion !== keyVersion) {
        throw new Error("Projection rebuild key metadata is invalid.");
      }
      const decrypted = await decryptProtectedFields(
        this.keyProvider,
        stageContext(this.ownerId, generationId, identityHash),
        { protectedPayload: envelope },
      );
      let protectedPayload: ProviderEventProtectedPayload;
      try {
        protectedPayload = JSON.parse(
          decrypted.protectedPayload as string,
        ) as ProviderEventProtectedPayload;
      } catch {
        throw new Error("Projection rebuild payload is invalid.");
      }
      decoded.push(
        ProviderEventChangeSchema.parse({
          ...planning,
          protected: protectedPayload,
        }),
      );
    }
    return decoded;
  }

  /** Marks a caught pre-activation failure cleanable without touching the active provider projection. */
  async abandon(generationId: string, now: Date): Promise<void> {
    requireBoundedText(generationId, 128);
    await this.database.execute(sql`
      update projection_rebuild_generations
      set status = 'abandoned', updated_at = ${now}
      where id = ${generationId}
        and owner_id = ${this.ownerId}
        and provider = ${PROVIDER}
        and status in ('staging', 'ready')
    `);
  }

  /**
   * Removes one bounded batch of stale nonactivated generations and their cascaded encrypted changes.
   *
   * The locked candidate and delete predicates repeat the owner, provider, calendar, job, status, and
   * timestamp boundary. A recent matching Queue job protects an otherwise stale generation; a missing
   * or equally stale job permits crash-orphan cleanup. Activated evidence is never eligible.
   */
  async cleanupExpired(now: Date): Promise<number> {
    const cleanupTime = readCleanupTime(now);
    const cutoff = new Date(cleanupTime - PROJECTION_REBUILD_RETENTION_MS);
    const result = await this.database.execute<CleanupRow>(sql`
      with cleanup_candidates as materialized (
        select
          generation.id,
          generation.owner_id,
          generation.provider,
          generation.provider_calendar_id,
          generation.job_id,
          generation.status,
          generation.updated_at
        from projection_rebuild_generations generation
        where generation.owner_id = ${this.ownerId}
          and generation.provider = ${PROVIDER}
          and generation.status in ('staging', 'ready', 'abandoned')
          and generation.updated_at <= ${cutoff}
          and (
            not exists (
              select 1
              from calendar_sync_jobs any_job
              where any_job.job_id = generation.job_id
            )
            or exists (
              select 1
              from calendar_sync_jobs matching_job
              where matching_job.job_id = generation.job_id
                and matching_job.owner_id = generation.owner_id
                and matching_job.provider = generation.provider
                and matching_job.provider_calendar_id =
                  generation.provider_calendar_id
                and matching_job.updated_at <= ${cutoff}
            )
          )
        order by generation.updated_at, generation.id
        limit ${PROJECTION_REBUILD_CLEANUP_BATCH_SIZE}
        for update of generation skip locked
      ),
      removed_generations as (
        delete from projection_rebuild_generations generation
        using cleanup_candidates candidate
        where generation.id = candidate.id
          and generation.owner_id = candidate.owner_id
          and generation.provider = candidate.provider
          and generation.provider_calendar_id = candidate.provider_calendar_id
          and generation.job_id = candidate.job_id
          and generation.status = candidate.status
          and generation.updated_at = candidate.updated_at
          and generation.owner_id = ${this.ownerId}
          and generation.provider = ${PROVIDER}
          and generation.status in ('staging', 'ready', 'abandoned')
          and generation.updated_at <= ${cutoff}
          and (
            not exists (
              select 1
              from calendar_sync_jobs any_job
              where any_job.job_id = generation.job_id
            )
            or exists (
              select 1
              from calendar_sync_jobs matching_job
              where matching_job.job_id = generation.job_id
                and matching_job.owner_id = generation.owner_id
                and matching_job.provider = generation.provider
                and matching_job.provider_calendar_id =
                  generation.provider_calendar_id
                and matching_job.updated_at <= ${cutoff}
            )
          )
        returning generation.id
      )
      select count(*)::integer as "removedCount"
      from removed_generations
    `);
    return readNonNegativeInteger(result.rows[0]?.removedCount);
  }

  /** Rejects every cross-owner staging attempt before any database or key access. */
  private assertOwner(ownerId: string): void {
    if (ownerId !== this.ownerId) {
      throw new Error("Projection rebuild owner scope does not match.");
    }
  }
}

/** Creates a production projection staging repository for one authenticated owner. */
export function createProjectionRepository(
  database: VisionDatabase,
  keyProvider: KeyProvider,
  ownerId: string,
): ProjectionRepository {
  return new EncryptedProjectionRepository(database, keyProvider, ownerId);
}

/** Validates durable generation metadata before persistence. */
function validateBegin(input: BeginProjectionRebuild): void {
  requireBoundedText(input.generationId, 128);
  requireBoundedText(input.ownerId, 128);
  requireBoundedText(input.calendarId, 2_048);
  requireBoundedText(input.jobId, 256);
  if (input.queueClaimId !== undefined) requireBoundedText(input.queueClaimId, 255);
  if (
    !Number.isSafeInteger(input.baseCheckpointVersion) ||
    input.baseCheckpointVersion <= 0 ||
    !(input.now instanceof Date) ||
    Number.isNaN(input.now.getTime())
  ) {
    throw new Error("Projection rebuild generation is invalid.");
  }
}

/** Rejects invalid or spoofed maintenance clocks before deriving a retention cutoff. */
function readCleanupTime(now: Date): number {
  if (!(now instanceof Date)) {
    throw new Error("Projection rebuild cleanup timestamp is invalid.");
  }
  const value = Date.prototype.getTime.call(now);
  if (!Number.isFinite(value)) {
    throw new Error("Projection rebuild cleanup timestamp is invalid.");
  }
  return value;
}

/** Produces the fixed-size opaque identity used for stage deduplication. */
async function digestIdentity(identity: {
  readonly sourceSystem: string;
  readonly sourceCalendarId: string;
  readonly sourceEventId: string;
}): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(JSON.stringify([
      identity.sourceSystem,
      identity.sourceCalendarId,
      identity.sourceEventId,
    ])),
  );
  return encodeBase64Url(new Uint8Array(digest));
}

/** Binds a stage ciphertext to its exact generation and provider identity digest. */
function stageContext(ownerId: string, generationId: string, identityHash: string) {
  return {
    ownerId,
    nodeId: `projection-rebuild:${generationId}:${identityHash}`,
    domain: "unresolved" as const,
  };
}

/** Serializes one strict cipher envelope into PostgreSQL binary storage. */
function encodeEnvelope(envelope: CipherEnvelope): Uint8Array {
  return textEncoder.encode(serializeCipherEnvelope(envelope));
}

/** Parses one PostgreSQL envelope after its byte boundary is validated. */
function decodeEnvelope(value: Uint8Array): CipherEnvelope {
  return parseCipherEnvelope(textDecoder.decode(value));
}

/** Reads a strict JSON object from PGlite or Neon. */
function readJsonObject(value: unknown): Record<string, unknown> {
  const parsed =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return undefined;
          }
        })()
      : value;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Projection rebuild planning row is invalid.");
  }
  return parsed as Record<string, unknown>;
}

/** Reads one canonical SHA-256 base64url digest. */
function readDigest(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(value)) {
    throw new Error("Projection rebuild digest is invalid.");
  }
  return value;
}

/** Reads one positive safe integer from a database row. */
function readPositiveInteger(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^[1-9]\d*$/u.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("Projection rebuild key metadata is invalid.");
  }
  return parsed;
}

/** Reads the aggregate returned by PostgreSQL without accepting fractional or negative cleanup counts. */
function readNonNegativeInteger(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "bigint"
        ? Number(value)
        : typeof value === "string" && /^(?:0|[1-9]\d*)$/u.test(value)
          ? Number(value)
          : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Projection rebuild cleanup result is invalid.");
  }
  return parsed;
}

/** Reads canonical PostgreSQL bytea or a copied PGlite byte array. */
function readBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return Uint8Array.prototype.slice.call(value);
  if (typeof value !== "string" || !/^\\x(?:[0-9a-f]{2})+$/u.test(value)) {
    throw new Error("Projection rebuild ciphertext is invalid.");
  }
  const bytes = new Uint8Array((value.length - 2) / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(2 + index * 2, 4 + index * 2), 16);
  }
  return bytes;
}

/** Recognizes bounded non-empty opaque metadata. */
function requireBoundedText(value: unknown, maximum: number): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximum
  ) {
    throw new Error("Projection rebuild metadata is invalid.");
  }
}
