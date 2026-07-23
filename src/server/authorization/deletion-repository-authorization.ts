/** Defines non-forgeable owner and system capabilities accepted by the deletion persistence boundary. */
import {
  hasVerifiedDeletionPurgeAccess,
  hasVerifiedDeletionRepositoryAccess,
} from "./deletion-capability-internal";

const ownerAccessBrand: unique symbol = Symbol("vision.deletion-owner-access");
const purgeAccessBrand: unique symbol = Symbol("vision.deletion-purge-access");

/** Opaque owner-scoped authority issued only after authenticated server composition. */
export interface VerifiedDeletionRepositoryAccess {
  readonly authenticatedOwnerId: string;
  readonly [ownerAccessBrand]: never;
}

/** Opaque system authority for scheduled global purge; it deliberately contains no user identity. */
export interface VerifiedDeletionPurgeAccess {
  readonly [purgeAccessBrand]: never;
}

/** Rejects a caller-shaped owner object that was not issued at the server authorization boundary. */
export function isVerifiedDeletionRepositoryAccess(
  value: unknown,
): value is VerifiedDeletionRepositoryAccess {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { authenticatedOwnerId?: unknown };
  return (
    hasVerifiedDeletionRepositoryAccess(value) &&
    typeof candidate.authenticatedOwnerId === "string" &&
    candidate.authenticatedOwnerId.length > 0
  );
}

/** Rejects a caller-shaped purge object that was not issued to the trusted scheduler composition root. */
export function isVerifiedDeletionPurgeAccess(
  value: unknown,
): value is VerifiedDeletionPurgeAccess {
  return typeof value === "object" && value !== null && hasVerifiedDeletionPurgeAccess(value);
}
