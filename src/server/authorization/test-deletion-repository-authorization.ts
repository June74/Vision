/** Supplies Vitest-only deletion capabilities that production bundles must never import. */
import {
  registerVerifiedDeletionPurgeAccess,
  registerVerifiedDeletionRepositoryAccess,
} from "./deletion-capability-internal";
import type {
  VerifiedDeletionPurgeAccess,
  VerifiedDeletionRepositoryAccess,
} from "./deletion-repository-authorization";

export const TEST_DELETION_AUTHORIZATION_BOUNDARY_MARKER =
  "VISION_TEST_DELETION_AUTHORIZATION_MODULE_MUST_NOT_REACH_PRODUCTION_BUNDLE";

/** Creates an owner capability only while a Vitest process is executing. */
export function createTestDeletionRepositoryAccess(
  authenticatedOwnerId: string,
): VerifiedDeletionRepositoryAccess {
  if (
    typeof process === "undefined" ||
    process.env.VITEST !== "true" ||
    typeof authenticatedOwnerId !== "string" ||
    authenticatedOwnerId.length === 0
  ) {
    throw new Error(TEST_DELETION_AUTHORIZATION_BOUNDARY_MARKER);
  }
  const access = Object.freeze({ authenticatedOwnerId });
  registerVerifiedDeletionRepositoryAccess(access);
  return access as unknown as VerifiedDeletionRepositoryAccess;
}

/** Creates the distinct trusted-scheduler capability only while a Vitest process is executing. */
export function createTestDeletionPurgeAccess(): VerifiedDeletionPurgeAccess {
  if (typeof process === "undefined" || process.env.VITEST !== "true") {
    throw new Error(TEST_DELETION_AUTHORIZATION_BOUNDARY_MARKER);
  }
  const access = Object.freeze({});
  registerVerifiedDeletionPurgeAccess(access);
  return access as VerifiedDeletionPurgeAccess;
}
