/** Defines and validates the only privacy-safe facts allowed in durable audit records. */
import { z } from "zod";

const safeCategoryCode = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u);
const opaqueAuditId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9_-]*$/u);

/** Strict runtime schema for opaque identities and controlled audit categories. */
export const SafeAuditEventSchema = z
  .object({
    id: opaqueAuditId,
    ownerId: opaqueAuditId,
    nodeId: opaqueAuditId.optional(),
    action: safeCategoryCode,
    actorType: z.enum(["user", "system", "provider", "model"]),
    occurredAt: z.string().datetime({ offset: true }),
    outcome: z.enum(["succeeded", "failed", "denied", "pending"]),
    provider: safeCategoryCode.optional(),
    errorCategory: safeCategoryCode.optional(),
  })
  .strict();

/** A closed durable audit event with no free-form content field. */
export type SafeAuditEvent = z.infer<typeof SafeAuditEventSchema>;

const SAFE_AUDIT_KEYS = new Set(Object.keys(SafeAuditEventSchema.shape));
const INVALID_AUDIT_EVENT_MESSAGE = "Audit event is outside the privacy-safe allowlist.";

/** Rejects audit records without reflecting or formatting any supplied value. */
export class SafeAuditEventValidationError extends Error {
  constructor() {
    super(INVALID_AUDIT_EVENT_MESSAGE);
    this.name = "SafeAuditEventValidationError";
  }
}

/** Validates exact plain-data shape before any value can reach serialization or a sink. */
export function validateSafeAuditEvent(event: unknown): SafeAuditEvent {
  if (typeof event !== "object" || event === null || Array.isArray(event)) {
    throw new SafeAuditEventValidationError();
  }

  const prototype = Object.getPrototypeOf(event);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new SafeAuditEventValidationError();
  }

  if (prototype === Object.prototype) {
    for (const inheritedKey of Reflect.ownKeys(Object.prototype)) {
      if (Object.getOwnPropertyDescriptor(Object.prototype, inheritedKey)?.enumerable) {
        // Inspect the inherited descriptor only. Never invoke a polluted getter.
        throw new SafeAuditEventValidationError();
      }
    }
  }

  const ownData = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(event)) {
    const descriptor = Object.getOwnPropertyDescriptor(event, key);
    if (
      typeof key !== "string" ||
      !SAFE_AUDIT_KEYS.has(key) ||
      !descriptor?.enumerable ||
      !("value" in descriptor)
    ) {
      // Inspect descriptors, never values, until symbols, hidden data, accessors, and unknown payloads are rejected.
      throw new SafeAuditEventValidationError();
    }
    Object.defineProperty(ownData, key, {
      value: descriptor.value,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }

  const parsed = SafeAuditEventSchema.safeParse(ownData);
  if (!parsed.success) {
    // Zod's detailed issue tree may retain rejected input; only a constant privacy-safe error crosses this boundary.
    throw new SafeAuditEventValidationError();
  }

  return parsed.data;
}
