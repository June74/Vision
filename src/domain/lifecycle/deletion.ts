/** Defines pure, provider-independent timing rules for Vision's recoverable deletion window. */

/** The fixed recovery period: thirty complete 24-hour days measured from the confirmed UTC deletion instant. */
export const RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;

/** The opaque node identity and UTC bounds retained while an encrypted record can still be restored. */
export interface RecoverableDeletion {
  readonly nodeId: string;
  readonly deletedAt: Date;
  readonly purgeAfter: Date;
}

/** Reports an invalid lifecycle input without including an identity or timestamp in the error message. */
export class DeletionLifecycleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeletionLifecycleValidationError";
  }
}

/** Builds one exact recovery record and rejects a caller that attempts to change the fixed retention period. */
export function markDeleted(
  nodeId: string,
  deletedAt: Date,
  purgeAfter = calculatePurgeAfter(deletedAt),
): RecoverableDeletion {
  if (typeof nodeId !== "string" || nodeId.length === 0) {
    throw new DeletionLifecycleValidationError("Deletion requires an opaque node ID.");
  }
  assertValidInstant(deletedAt);
  assertValidInstant(purgeAfter);
  if (purgeAfter.getTime() !== calculatePurgeAfter(deletedAt).getTime()) {
    throw new DeletionLifecycleValidationError("Recovery window must be exactly 30 days.");
  }
  return { nodeId, deletedAt: new Date(deletedAt), purgeAfter: new Date(purgeAfter) };
}

/** Returns the exact UTC purge instant for a confirmed deletion time, with no calendar-month interpretation. */
export function calculatePurgeAfter(deletedAt: Date): Date {
  assertValidInstant(deletedAt);
  return new Date(deletedAt.getTime() + RECOVERY_WINDOW_MS);
}

/** Allows recovery strictly before the deadline; the deadline itself belongs to permanent purge. */
export function canRestore(
  deletion: Pick<RecoverableDeletion, "deletedAt" | "purgeAfter">,
  now: Date,
): boolean {
  assertValidInstant(deletion.deletedAt);
  assertValidInstant(deletion.purgeAfter);
  assertValidInstant(now);
  return now.getTime() < deletion.purgeAfter.getTime();
}

/** Returns whether an encrypted recovery record must be permanently purged at the supplied UTC instant. */
export function isPurgeDue(
  deletion: Pick<RecoverableDeletion, "deletedAt" | "purgeAfter">,
  now: Date,
): boolean {
  assertValidInstant(deletion.deletedAt);
  assertValidInstant(deletion.purgeAfter);
  assertValidInstant(now);
  return now.getTime() >= deletion.purgeAfter.getTime();
}

/** Ensures only valid JavaScript `Date` values reach the persistence boundary. */
function assertValidInstant(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new DeletionLifecycleValidationError("Deletion lifecycle requires a valid UTC instant.");
  }
}
