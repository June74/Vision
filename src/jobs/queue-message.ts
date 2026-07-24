/** Defines and validates the protected-content-free messages carried by the calendar sync queue. */
import { z } from "zod";
import type { SyncReason } from "./sync-calendar";

/** Strict queue schema that rejects extra fields before any job is claimed. */
export const CalendarSyncMessageSchema = z
  .object({
    jobId: z.string().min(1).max(256),
    ownerId: z.string().min(1).max(128),
    calendarId: z.string().min(1).max(2_048),
    reason: z.enum(["initial", "manual", "push", "rebuild", "repair"]),
  })
  .strict();

/** Opaque synchronization signal safe for Cloudflare Queue transport. */
export interface CalendarSyncMessage {
  readonly jobId: string;
  readonly ownerId: string;
  readonly calendarId: string;
  readonly reason: SyncReason;
}

/** Returns one frozen, strictly validated queue message without copying unknown fields. */
export function parseCalendarSyncMessage(value: unknown): CalendarSyncMessage {
  return Object.freeze(CalendarSyncMessageSchema.parse(value));
}
