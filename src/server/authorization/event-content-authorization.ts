/** Issues unforgeable repository decisions after server-owned owner and privacy policy checks. */
import {
  PrivacyLevelSchema,
  type PrivacyLevel,
} from "../../domain/privacy/privacy";

const decisionBrand = Symbol("vision.event-content-authorization");

/** Facts the repository must authorize before selecting protected event columns. */
export interface EventContentAuthorizationRequest {
  readonly authenticatedOwnerId: string;
  readonly eventOwnerId: string;
  readonly privacy: PrivacyLevel;
}

/** Private-symbol-branded decision that ordinary repository callers cannot construct. */
export interface EventContentAuthorizationDecision
  extends EventContentAuthorizationRequest {
  readonly [decisionBrand]: true;
}

/** Server-owned policy port used by the owner-scoped event repository. */
export interface EventContentAuthorizationPolicy {
  authorize(
    request: EventContentAuthorizationRequest,
  ): EventContentAuthorizationDecision | undefined;
}

/** Application policy callback supplied by the future authenticated server composition root. */
export type EventPrivacyPolicy = (
  ownerId: string,
  privacy: PrivacyLevel,
) => boolean;

/** Creates an owner-enforcing policy that alone can attach the private runtime decision brand. */
export function createEventContentAuthorizationPolicy(
  canReadPrivacy: EventPrivacyPolicy,
): EventContentAuthorizationPolicy {
  return {
    /** Returns a branded decision only after both owner equality and the injected privacy rule pass. */
    authorize(
      request: EventContentAuthorizationRequest,
    ): EventContentAuthorizationDecision | undefined {
      if (
        !isValidRequest(request) ||
        request.authenticatedOwnerId !== request.eventOwnerId ||
        !canReadPrivacy(request.eventOwnerId, request.privacy)
      ) {
        return undefined;
      }

      return Object.freeze({
        ...request,
        [decisionBrand]: true as const,
      });
    },
  };
}

/** Verifies both the private brand and exact authorized facts before protected selection. */
export function matchesEventContentAuthorizationDecision(
  decision: EventContentAuthorizationDecision | undefined,
  request: EventContentAuthorizationRequest,
): decision is EventContentAuthorizationDecision {
  return (
    decision !== undefined &&
    decision[decisionBrand] === true &&
    decision.authenticatedOwnerId === request.authenticatedOwnerId &&
    decision.eventOwnerId === request.eventOwnerId &&
    decision.privacy === request.privacy
  );
}

/** Validates the closed owner and privacy request without coercion. */
function isValidRequest(
  request: EventContentAuthorizationRequest,
): boolean {
  return (
    typeof request === "object" &&
    request !== null &&
    typeof request.authenticatedOwnerId === "string" &&
    request.authenticatedOwnerId.length > 0 &&
    typeof request.eventOwnerId === "string" &&
    request.eventOwnerId.length > 0 &&
    PrivacyLevelSchema.safeParse(request.privacy).success
  );
}
