/** Defines the provider-neutral checkpoint committed only after a complete synchronization transaction succeeds. */
import { z } from "zod";

/** Validates one opaque, versioned synchronization cursor without exposing provider implementation details. */
export const SyncCheckpointSchema = z
  .object({
    calendarId: z.string().min(1),
    committedAt: z.string().datetime({ offset: true }),
    syncToken: z.string().min(1),
    version: z.number().int().positive(),
  })
  .strict();

/** The closed synchronization cursor passed between provider-independent jobs and persistence. */
export type SyncCheckpoint = z.infer<typeof SyncCheckpointSchema>;
