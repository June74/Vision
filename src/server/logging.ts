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
    entityId: z.string().uuid().optional(),
    entityIds: z.array(z.string().uuid()).optional(),
  })
  .strict();

/** Represents a validated audit event that contains no free-form user content. */
export type SafeLogEvent = z.infer<typeof SafeLogEventSchema>;

/** Receives a validated audit event from the application runtime. */
export type SafeLogger = (event: SafeLogEvent) => void;

const SAFE_LOG_FIELDS = new Set(Object.keys(SafeLogEventSchema.shape));

/** Sends a strictly allowlisted audit event to an injected logger. */
export function logEvent(logger: SafeLogger, event: unknown): void {
  if (typeof event !== "object" || event === null) {
    SafeLogEventSchema.parse(event);
    return;
  }

  const prototype = Object.getPrototypeOf(event);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Unsupported audit event prototype");
  }

  for (const key of Reflect.ownKeys(event)) {
    const descriptor = Object.getOwnPropertyDescriptor(event, key);
    if (typeof key !== "string" || !SAFE_LOG_FIELDS.has(key) || !descriptor?.enumerable) {
      // Reject hidden fields before parsing so private values cannot reach an error formatter or log sink.
      throw new Error("Unsupported audit field");
    }
  }

  const safeEvent = SafeLogEventSchema.parse(event);
  logger(safeEvent);
}
