/** Stages every provider page before one atomic event-projection and checkpoint commit. */
import type { ProviderEventChange } from "../domain/sync/change";
import { MAX_PROTECTED_PLAINTEXT_BYTES } from "../crypto/envelope";
import {
  SyncCheckpointSchema,
  type SyncCheckpoint,
} from "../domain/sync/checkpoint";
import {
  EventSyncClientError,
  type EventSyncClient,
} from "../integrations/google-calendar/event-sync-client";

const MAX_STAGED_CHANGES = 25_000;
const MAX_PAGES = 10_000;
const MAX_DELIVERY_ATTEMPTS = 6;
const MAX_STAGED_MEMORY_BYTES = 32 * 1024 * 1024;
const STAGED_COPY_MULTIPLIER = 8;
const STAGED_CHANGE_OVERHEAD_BYTES = 4 * 1024;
const utf8Encoder = new TextEncoder();

/** Opaque synchronization job payload safe for queue transport. */
export type SyncReason = "initial" | "manual" | "push" | "rebuild" | "repair";

/** Opaque synchronization job payload safe for queue transport. */
export interface SyncCalendarRequest {
  readonly ownerId: string;
  readonly calendarId: string;
  readonly reason: SyncReason;
  readonly jobId: string;
  readonly deliveryAttempt?: number;
}

/** Atomic repository request built only after the terminal provider page succeeds. */
export interface SyncApplyRequest {
  readonly ownerId: string;
  readonly calendarId: string;
  readonly expectedCheckpointVersion: number;
  readonly changes: readonly ProviderEventChange[];
  readonly nextCheckpoint: SyncCheckpoint;
  readonly jobId: string;
  readonly reason: SyncReason;
  readonly pageCount: number;
  readonly startedAt: string;
}

/** Safe atomic repository outcome with no provider or protected content. */
export type SyncApplyResult =
  | {
      readonly outcome: "committed";
      readonly upserted: number;
      readonly deleted: number;
      readonly unchanged: number;
    }
  | { readonly outcome: "conflict" };

/** Connection state persisted after a failed attempt without changing its checkpoint. */
export type SyncFailureState =
  | "action_required"
  | "disconnected"
  | "rebuild_required"
  | "retry_scheduled";

/** Safe failure metadata accepted by synchronization persistence. */
export interface SyncFailureRecord {
  readonly ownerId: string;
  readonly calendarId: string;
  readonly category: SyncCalendarErrorCategory;
  readonly state: SyncFailureState;
  readonly occurredAt: string;
  readonly jobId: string;
  readonly expectedCheckpointVersion?: number;
}

/** Persistence boundary whose success must cover changes, invalidations, and checkpoint atomically. */
export interface SyncRepository {
  loadCheckpoint(ownerId: string, calendarId: string): Promise<SyncCheckpoint | undefined>;
  applyChanges(request: SyncApplyRequest): Promise<SyncApplyResult>;
  recordFailure(record: SyncFailureRecord): Promise<void>;
}

/** Injectable job dependencies supporting deterministic queue retry tests. */
export interface SyncCalendarDependencies {
  readonly client: EventSyncClient;
  readonly repository: SyncRepository;
  readonly now?: () => Date;
  readonly random?: () => number;
}

/** Safe job-level categories used by queue and health consumers. */
export type SyncCalendarErrorCategory =
  | "authorization"
  | "concurrency"
  | "database"
  | "provider"
  | "payload_too_large"
  | "quota"
  | "schema"
  | "sync_token_invalid"
  | "transient";

/** Result recorded after a complete synchronization commit. */
export interface SyncResult {
  readonly status: "succeeded";
  readonly reason: SyncReason;
  readonly jobId: string;
  readonly pages: number;
  readonly staged: number;
  readonly upserted: number;
  readonly deleted: number;
  readonly unchanged: number;
  readonly checkpointVersion: number;
  readonly durationMs: number;
}

/** Signals a bounded queue-redelivery decision without retaining payload or protected content. */
export class SyncCalendarError extends Error {
  /** Creates a constant-text safe job error with explicit queue disposition. */
  constructor(
    readonly category: SyncCalendarErrorCategory,
    readonly state: SyncFailureState,
    readonly retry: boolean,
    readonly retryDelaySeconds?: number,
  ) {
    super("Calendar synchronization did not commit.");
    this.name = "SyncCalendarError";
  }
}

/** Retrieves all pages and advances the checkpoint only through one successful repository commit. */
export async function syncCalendar(
  request: SyncCalendarRequest,
  dependencies: SyncCalendarDependencies,
): Promise<SyncResult> {
  const input = validateJobRequest(request);
  const now = dependencies.now ?? (() => new Date());
  const random = dependencies.random ?? Math.random;
  const started = now();
  const startedAt = Date.prototype.getTime.call(started);
  let checkpoint: SyncCheckpoint | undefined;
  let checkpointLoaded = false;

  try {
    try {
      checkpoint = await dependencies.repository.loadCheckpoint(
        input.ownerId,
        input.calendarId,
      );
      checkpointLoaded = true;
    } catch {
      throw retryError("database", input.deliveryAttempt, random);
    }
    if (checkpoint?.calendarId !== undefined && checkpoint.calendarId !== input.calendarId) {
      throw new SyncCalendarError("schema", "action_required", false);
    }

    const staged = new Map<string, { serialized: string; change: ProviderEventChange }>();
    let stagedMemoryBytes = 0;
    let pageToken: string | undefined;
    let calendarTimeZone: string | undefined;
    let nextSyncToken: string | undefined;
    let pages = 0;

    do {
      if (pages >= MAX_PAGES) {
        throw new SyncCalendarError("schema", "action_required", false);
      }
      const page = await dependencies.client.listChanges({
        calendarId: input.calendarId,
        syncToken: checkpoint?.syncToken,
        pageToken,
      });
      pages += 1;

      if (
        calendarTimeZone !== undefined &&
        calendarTimeZone !== page.calendarTimeZone
      ) {
        throw new SyncCalendarError("schema", "action_required", false);
      }
      calendarTimeZone = page.calendarTimeZone;
      for (const change of page.changes) {
        stagedMemoryBytes += stageChange(staged, change);
        if (stagedMemoryBytes > MAX_STAGED_MEMORY_BYTES) {
          throw new SyncCalendarError(
            "payload_too_large",
            "action_required",
            false,
          );
        }
        if (staged.size > MAX_STAGED_CHANGES) {
          throw new SyncCalendarError("schema", "action_required", false);
        }
      }

      if (page.nextPageToken !== undefined) {
        if (page.nextSyncToken !== undefined) {
          throw new SyncCalendarError("schema", "action_required", false);
        }
        pageToken = page.nextPageToken;
      } else {
        if (page.nextSyncToken === undefined) {
          throw new SyncCalendarError("schema", "action_required", false);
        }
        pageToken = undefined;
        nextSyncToken = page.nextSyncToken;
      }
    } while (pageToken !== undefined);

    if (nextSyncToken === undefined) {
      throw new SyncCalendarError("schema", "action_required", false);
    }
    const committedAt = Date.prototype.toISOString.call(now());
    const nextCheckpoint = SyncCheckpointSchema.parse({
      calendarId: input.calendarId,
      syncToken: nextSyncToken,
      committedAt,
      version: (checkpoint?.version ?? 0) + 1,
    });

    let applied: SyncApplyResult;
    try {
      applied = await dependencies.repository.applyChanges({
        ownerId: input.ownerId,
        calendarId: input.calendarId,
        expectedCheckpointVersion: checkpoint?.version ?? 0,
        changes: [...staged.values()].map(({ change }) => change),
        nextCheckpoint,
        reason: input.reason,
        jobId: input.jobId,
        pageCount: pages,
        startedAt: Date.prototype.toISOString.call(started),
      });
    } catch {
      throw retryError("database", input.deliveryAttempt, random);
    }
    if (applied.outcome === "conflict") {
      throw retryError("concurrency", input.deliveryAttempt, random);
    }

    return {
      status: "succeeded",
      reason: input.reason,
      jobId: input.jobId,
      pages,
      staged: staged.size,
      upserted: applied.upserted,
      deleted: applied.deleted,
      unchanged: applied.unchanged,
      checkpointVersion: nextCheckpoint.version,
      durationMs: Math.max(0, Date.prototype.getTime.call(now()) - startedAt),
    };
  } catch (error) {
    const failure = normalizeFailure(error, input.deliveryAttempt, random);
    try {
      await dependencies.repository.recordFailure({
        ownerId: input.ownerId,
        calendarId: input.calendarId,
        category: failure.category,
        state: failure.state,
        occurredAt: Date.prototype.toISOString.call(now()),
        jobId: input.jobId,
        expectedCheckpointVersion: checkpointLoaded
          ? checkpoint?.version ?? 0
          : undefined,
      });
    } catch {
      // Failure bookkeeping is best effort and must never replace the queue disposition.
    }
    throw failure;
  }
}

/** Deduplicates exact provider identities and rejects ambiguous same-batch ordering. */
function stageChange(
  staged: Map<string, { serialized: string; change: ProviderEventChange }>,
  change: ProviderEventChange,
): number {
  validateProtectedPayloadSizes(change);
  const identity = change.type === "upsert" ? change.identity : change.target;
  const key = JSON.stringify([
    identity.sourceSystem,
    identity.sourceCalendarId,
    identity.sourceEventId,
  ]);
  const serialized = canonicalJson(change);
  const existing = staged.get(key);
  if (existing && existing.serialized !== serialized) {
    // Unversioned tombstones cannot be ordered against an upsert or another distinct representation.
    throw new SyncCalendarError("schema", "action_required", false);
  }
  if (existing) return 0;
  staged.set(key, { serialized, change });
  return (
    utf8ByteLength(serialized) * STAGED_COPY_MULTIPLIER +
    STAGED_CHANGE_OVERHEAD_BYTES
  );
}

/** Rejects any protected serialization that cannot fit the shared 64 KiB encryption boundary. */
function validateProtectedPayloadSizes(change: ProviderEventChange): void {
  if (change.type === "delete") return;
  const fields = [
    change.protected.title,
    change.protected.description,
    JSON.stringify(change.protected.attendees),
    change.protected.location,
    change.protected.meetingLinks[0] ?? null,
    JSON.stringify(change.protected),
  ];
  if (
    fields.some(
      (value) =>
        value !== null &&
        utf8ByteLength(value) > MAX_PROTECTED_PLAINTEXT_BYTES,
    )
  ) {
    throw new SyncCalendarError(
      "payload_too_large",
      "action_required",
      false,
    );
  }
}

/** Measures the actual UTF-8 allocation used by the encryption boundary. */
function utf8ByteLength(value: string): number {
  return utf8Encoder.encode(value).byteLength;
}

/** Serializes mapper output deterministically for duplicate equality only. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Converts provider and unexpected failures into safe connection and queue semantics. */
function normalizeFailure(
  error: unknown,
  deliveryAttempt: number,
  random: () => number,
): SyncCalendarError {
  if (error instanceof SyncCalendarError) {
    if (error.retry && deliveryAttempt >= MAX_DELIVERY_ATTEMPTS) {
      return new SyncCalendarError(error.category, "action_required", false);
    }
    return error;
  }
  if (error instanceof EventSyncClientError) {
    if (error.category === "authorization") {
      return new SyncCalendarError("authorization", "disconnected", false);
    }
    if (
      error.category === "schema" ||
      error.category === "provider" ||
      error.category === "payload_too_large"
    ) {
      return new SyncCalendarError(error.category, "action_required", false);
    }
    if (error.category === "sync_token_invalid") {
      return new SyncCalendarError("sync_token_invalid", "rebuild_required", false);
    }
    if (error.category === "quota") {
      return new SyncCalendarError("quota", "action_required", false);
    }
    return retryError("transient", deliveryAttempt, random);
  }
  return retryError("transient", deliveryAttempt, random);
}

/** Produces exponential delay with bounded jitter for queue redelivery, never an in-request loop. */
function retryError(
  category: "concurrency" | "database" | "transient",
  deliveryAttempt: number,
  random: () => number,
): SyncCalendarError {
  if (deliveryAttempt >= MAX_DELIVERY_ATTEMPTS) {
    return new SyncCalendarError(category, "action_required", false);
  }
  const base = Math.min(300, 5 * 2 ** Math.max(0, deliveryAttempt - 1));
  const jitter = Math.floor(Math.max(0, Math.min(0.999_999, random())) * base);
  return new SyncCalendarError(
    category,
    "retry_scheduled",
    true,
    Math.min(600, base + jitter),
  );
}

/** Validates bounded opaque job metadata before provider or persistence access. */
function validateJobRequest(request: SyncCalendarRequest): Required<SyncCalendarRequest> {
  if (
    typeof request !== "object" ||
    request === null ||
    !boundedText(request.ownerId, 128) ||
    !boundedText(request.calendarId, 2_048) ||
    !["initial", "manual", "push", "rebuild", "repair"].includes(request.reason) ||
    !boundedText(request.jobId, 256)
  ) {
    throw new SyncCalendarError("schema", "action_required", false);
  }
  const deliveryAttempt = request.deliveryAttempt ?? 1;
  if (!Number.isSafeInteger(deliveryAttempt) || deliveryAttempt <= 0) {
    throw new SyncCalendarError("schema", "action_required", false);
  }
  return { ...request, deliveryAttempt };
}

/** Recognizes a bounded non-empty opaque identifier. */
function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}
