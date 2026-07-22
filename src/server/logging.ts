/** Validates and emits the minimal structured audit events that Vision is allowed to retain. */
import { z } from "zod";

/** Describes the allowlisted fields in a privacy-safe audit event. */
export const SafeLogEventSchema = z
  .object({
    requestId: z.string().min(1),
    action: z.string().min(1),
    outcome: z.string().min(1),
    errorCategory: z.string().min(1).optional(),
    durationMs: z.number().finite().nonnegative().optional(),
    provider: z.string().min(1).optional(),
    retryCount: z.number().int().nonnegative().optional(),
    entityId: z.string().min(1).optional(),
    entityIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

/** Represents a validated audit event that contains no free-form user content. */
export type SafeLogEvent = z.infer<typeof SafeLogEventSchema>;

/** Receives a validated audit event from the application runtime. */
export type SafeLogger = (event: SafeLogEvent) => void;

const SAFE_LOG_FIELDS = new Set(Object.keys(SafeLogEventSchema.shape));

/** Sends a strictly allowlisted audit event to an injected logger. */
export function logEvent(logger: SafeLogger, event: unknown): void {
  if (typeof event === "object" && event !== null) {
    const unsupportedField = Object.keys(event).find((field) => !SAFE_LOG_FIELDS.has(field));

    if (unsupportedField) {
      // Check keys before validation so private values are never formatted into an error or a log.
      throw new Error(`Unsupported audit field: ${unsupportedField}`);
    }
  }

  const safeEvent = SafeLogEventSchema.parse(event);
  logger(safeEvent);
}
