/** Vitest-only issuer for repository access; production source and bundles must never import this module. */
import {
  registerEventContentAuthorizationDecision,
  registerVerifiedEventRepositoryAccess,
} from "./event-content-capability-internal";
import type {
  EventContentAuthorizationRequest,
  VerifiedEventRepositoryAccess,
} from "./event-content-authorization";

export const TEST_AUTHORIZATION_BOUNDARY_MARKER =
  "VISION_TEST_AUTHORIZATION_MODULE_MUST_NOT_REACH_PRODUCTION_BUNDLE";

/** Creates verified test access only while running inside Vitest. */
export function createTestEventRepositoryAccess(
  authenticatedOwnerId: string,
  canReadPrivacy: (request: EventContentAuthorizationRequest) => boolean = () => true,
): VerifiedEventRepositoryAccess {
  if (
    typeof process === "undefined" ||
    process.env.VITEST !== "true" ||
    typeof authenticatedOwnerId !== "string" ||
    authenticatedOwnerId.length === 0
  ) {
    throw new Error(TEST_AUTHORIZATION_BOUNDARY_MARKER);
  }

  const access = Object.freeze({
    authenticatedOwnerId,
    /** Issues a branded test decision only for the fixed owner and configured test privacy rule. */
    authorize(request: EventContentAuthorizationRequest) {
      if (
        request.authenticatedOwnerId !== authenticatedOwnerId ||
        request.eventOwnerId !== authenticatedOwnerId ||
        !canReadPrivacy(request)
      ) {
        return undefined;
      }
      return registerEventContentAuthorizationDecision(
        Object.freeze({ ...request }),
      ) as ReturnType<VerifiedEventRepositoryAccess["authorize"]>;
    },
  });
  registerVerifiedEventRepositoryAccess(access);
  return access as unknown as VerifiedEventRepositoryAccess;
}
