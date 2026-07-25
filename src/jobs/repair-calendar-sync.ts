/** Reserves deterministic scheduled-repair work and sends only opaque queue messages. */
import type { ReserveWebhookJobResult } from "../data/repositories/job-repository";
import type { CalendarSyncMessage } from "./queue-message";

const REPAIR_INTERVAL_MS = 15 * 60_000;

/** One connected private calendar eligible for missed-notification repair. */
export interface RepairCalendar {
  readonly ownerId: string;
  readonly calendarId: string;
  readonly checkpointVersion: number;
}

/** One canonical setup bridge plus its deterministic initial Queue reservation. */
export interface BootstrapRepairResult {
  readonly message: CalendarSyncMessage;
  readonly shouldEnqueue: boolean;
}

/** Persistence seam for selecting and durably reserving repair work. */
export interface RepairRepository {
  bootstrapConnectedCalendars(now: Date): Promise<readonly BootstrapRepairResult[]>;
  listRepairCandidates(now: Date): Promise<readonly RepairCalendar[]>;
  reserveRepairJob(
    message: CalendarSyncMessage,
    now: Date,
  ): Promise<ReserveWebhookJobResult>;
  markEnqueued(jobId: string, now: Date): Promise<void>;
}

/** Minimal queue producer that cannot accept protected provider content. */
export interface RepairQueue {
  send(message: CalendarSyncMessage): Promise<unknown>;
}

/** Complete injected repair boundaries. */
export interface RepairDependencies {
  readonly repository: RepairRepository;
  readonly queue: RepairQueue;
}

/** Enqueues one deduplicated repair for every calendar stale at this schedule boundary. */
export async function repairCalendarSync(
  now: Date,
  dependencies: RepairDependencies,
): Promise<void> {
  assertDate(now);
  const bootstrapped = await dependencies.repository.bootstrapConnectedCalendars(now);
  for (const initial of bootstrapped) {
    if (!initial.shouldEnqueue) continue;
    await dependencies.queue.send(initial.message);
    await dependencies.repository.markEnqueued(initial.message.jobId, now);
  }
  const candidates = await dependencies.repository.listRepairCandidates(now);
  for (const candidate of candidates) {
    const message: CalendarSyncMessage = Object.freeze({
      jobId: await repairJobId(candidate, now),
      ownerId: candidate.ownerId,
      calendarId: candidate.calendarId,
      reason: "repair",
    });
    const reserved = await dependencies.repository.reserveRepairJob(message, now);
    if (!reserved.shouldEnqueue) continue;
    await dependencies.queue.send(reserved.message);
    await dependencies.repository.markEnqueued(reserved.message.jobId, now);
  }
}

/** Derives a stable idempotency key for one calendar/checkpoint/15-minute slot. */
async function repairJobId(
  candidate: RepairCalendar,
  now: Date,
): Promise<string> {
  const slot = Math.floor(now.getTime() / REPAIR_INTERVAL_MS);
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        JSON.stringify([
          "vision-calendar-repair",
          1,
          candidate.ownerId,
          candidate.calendarId,
          candidate.checkpointVersion,
          slot,
        ]),
      ),
    ),
  );
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return `repair_${btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "")}`;
}

/** Requires an intrinsic finite scheduler timestamp. */
function assertDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("Invalid repair timestamp.");
  }
}
