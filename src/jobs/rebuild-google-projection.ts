/** Rebuilds an invalid Google projection through encrypted durable staging and one atomic activation. */
import { MAX_PROTECTED_PLAINTEXT_BYTES } from "../crypto/envelope";
import type { ProjectionRepository } from "../data/repositories/projection-repository";
import type { ProviderEventChange } from "../domain/sync/change";
import {
  SyncCheckpointSchema,
  type SyncCheckpoint,
} from "../domain/sync/checkpoint";
import type { EventSyncClient } from "../integrations/google-calendar/event-sync-client";
import {
  SyncCalendarError,
  type SyncReason,
  type SyncRepository,
  type SyncResult,
} from "./sync-calendar";

const MAX_STAGED_CHANGES = 25_000;
const MAX_PAGES = 10_000;
const MAX_STAGED_MEMORY_BYTES = 32 * 1024 * 1024;
const STAGED_COPY_MULTIPLIER = 8;
const STAGED_CHANGE_OVERHEAD_BYTES = 4 * 1024;
const utf8Encoder = new TextEncoder();

/** Dependencies that retain the invalid checkpoint generation and optional durable queue lease. */
export interface RebuildGoogleProjectionDependencies {
  readonly client: EventSyncClient;
  readonly repository: SyncRepository;
  readonly projectionRepository: ProjectionRepository;
  readonly checkpoint: SyncCheckpoint;
  readonly jobId: string;
  readonly jobReason?: SyncReason;
  readonly queueClaimId?: string;
  readonly now?: () => Date;
}

/** Safe full-projection outcome recorded through the normal synchronization result contract. */
export type RebuildResult = SyncResult;

/** Streams a Google full listing into encrypted staging, then atomically replaces provider-owned facts only. */
export async function rebuildGoogleProjection(
  ownerId: string,
  calendarId: string,
  dependencies: RebuildGoogleProjectionDependencies,
): Promise<RebuildResult> {
  validateRequest(ownerId, calendarId, dependencies);
  const now = dependencies.now ?? (() => new Date());
  const started = now();
  const startedAt = Date.prototype.getTime.call(started);
  const generationId = `rebuild_${crypto.randomUUID()}`;
  const begun = await dependencies.projectionRepository.beginRebuild({
    generationId,
    ownerId,
    calendarId,
    jobId: dependencies.jobId,
    baseCheckpointVersion: dependencies.checkpoint.version,
    ...(dependencies.queueClaimId === undefined
      ? {}
      : { queueClaimId: dependencies.queueClaimId }),
    now: started,
  });
  if (begun.outcome === "activated") {
    throw new SyncCalendarError("concurrency", "retry_scheduled", true);
  }

  const staged = new Map<string, string>();
  let stagedMemoryBytes = 0;
  let pageToken: string | undefined;
  let calendarTimeZone: string | undefined;
  let nextSyncToken: string | undefined;
  let pages = 0;
  let ordinal = 0;

  try {
    do {
      if (pages >= MAX_PAGES) {
        throw new SyncCalendarError("schema", "action_required", false);
      }
      const page = await dependencies.client.listChanges({
        calendarId,
        syncToken: undefined,
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

      const newChanges: ProviderEventChange[] = [];
      for (const change of page.changes) {
        validateProtectedPayloadSizes(change);
        const identity = change.type === "upsert" ? change.identity : change.target;
        const key = JSON.stringify([
          identity.sourceSystem,
          identity.sourceCalendarId,
          identity.sourceEventId,
        ]);
        const serialized = canonicalJson(change);
        const existing = staged.get(key);
        if (existing !== undefined && existing !== serialized) {
          throw new SyncCalendarError("schema", "action_required", false);
        }
        if (existing !== undefined) continue;
        staged.set(key, serialized);
        stagedMemoryBytes +=
          utf8ByteLength(serialized) * STAGED_COPY_MULTIPLIER +
          STAGED_CHANGE_OVERHEAD_BYTES;
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
        newChanges.push(change);
      }
      await dependencies.projectionRepository.stageChanges(
        generationId,
        ordinal,
        newChanges,
      );
      ordinal += newChanges.length;

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
    if (
      !(await dependencies.projectionRepository.markReady(
        generationId,
        pages,
        now(),
      ))
    ) {
      throw new SyncCalendarError("concurrency", "retry_scheduled", true);
    }
    const changes =
      await dependencies.projectionRepository.loadStagedChanges(generationId);
    if (changes.length !== staged.size) {
      throw new SyncCalendarError("database", "retry_scheduled", true);
    }
    const nextCheckpoint = SyncCheckpointSchema.parse({
      calendarId,
      syncToken: nextSyncToken,
      committedAt: Date.prototype.toISOString.call(now()),
      version: dependencies.checkpoint.version + 1,
    });
    const applied = await dependencies.repository.applyChanges({
      ownerId,
      calendarId,
      expectedCheckpointVersion: dependencies.checkpoint.version,
      changes,
      nextCheckpoint,
      jobId: dependencies.jobId,
      reason: "rebuild",
      ...(dependencies.queueClaimId === undefined
        ? {}
        : { queueJobReason: dependencies.jobReason ?? "rebuild" }),
      pageCount: pages,
      startedAt: Date.prototype.toISOString.call(started),
      replaceProjection: true,
      rebuildGenerationId: generationId,
      ...(dependencies.queueClaimId === undefined
        ? {}
        : { queueClaimId: dependencies.queueClaimId }),
    });
    if (applied.outcome === "conflict") {
      throw new SyncCalendarError("concurrency", "retry_scheduled", true);
    }
    return {
      status: "succeeded",
      reason: "rebuild",
      jobId: dependencies.jobId,
      pages,
      staged: changes.length,
      upserted: applied.upserted,
      deleted: applied.deleted,
      unchanged: applied.unchanged,
      checkpointVersion: nextCheckpoint.version,
      durationMs: Math.max(0, Date.prototype.getTime.call(now()) - startedAt),
    };
  } catch (error) {
    try {
      await dependencies.projectionRepository.abandon(generationId, now());
    } catch {
      // Staging cleanup is best effort; a crash-safe abandoned generation never owns the active projection.
    }
    throw error;
  }
}

/** Validates the owner, calendar, invalid checkpoint, and opaque job authority. */
function validateRequest(
  ownerId: string,
  calendarId: string,
  dependencies: RebuildGoogleProjectionDependencies,
): void {
  if (
    !boundedText(ownerId, 128) ||
    !boundedText(calendarId, 2_048) ||
    !boundedText(dependencies.jobId, 256) ||
    (dependencies.queueClaimId !== undefined &&
      !boundedText(dependencies.queueClaimId, 255)) ||
    dependencies.checkpoint.calendarId !== calendarId ||
    dependencies.checkpoint.version <= 0
  ) {
    throw new SyncCalendarError("schema", "action_required", false);
  }
}

/** Retains the same per-field and complete protected-payload limits as incremental sync. */
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

/** Measures actual UTF-8 allocation at the encryption and Worker-memory boundaries. */
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
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Recognizes bounded non-empty opaque metadata. */
function boundedText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum
  );
}
