/** Verifies non-forgeable server-composition authority before protected event access. */
import type { PrivacyLevel } from "../../domain/privacy/privacy";
import {
  hasEventContentAuthorizationDecision,
  hasVerifiedEventRepositoryAccess,
} from "./event-content-capability-internal";

const decisionTypeBrand: unique symbol = Symbol("vision.event-content-decision-type");
const accessTypeBrand: unique symbol = Symbol("vision.event-repository-access-type");

/** Facts the repository must authorize before selecting protected event columns. */
export interface EventContentAuthorizationRequest {
  readonly authenticatedOwnerId: string;
  readonly eventOwnerId: string;
  readonly privacy: PrivacyLevel;
}

/** Private-symbol-branded decision issued only by verified server access. */
export interface EventContentAuthorizationDecision
  extends EventContentAuthorizationRequest {
  readonly [decisionTypeBrand]: never;
}

/** Opaque access capability that a repository accepts from the server composition root. */
export interface VerifiedEventRepositoryAccess {
  readonly authenticatedOwnerId: string;
  readonly [accessTypeBrand]: never;
  authorize(
    request: EventContentAuthorizationRequest,
  ): EventContentAuthorizationDecision | undefined;
}

/** Rejects caller-shaped objects that were not issued by the server capability boundary. */
export function isVerifiedEventRepositoryAccess(
  value: unknown,
): value is VerifiedEventRepositoryAccess {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { authenticatedOwnerId?: unknown; authorize?: unknown };
  return (
    hasVerifiedEventRepositoryAccess(value) &&
    typeof candidate.authenticatedOwnerId === "string" &&
    candidate.authenticatedOwnerId.length > 0 &&
    typeof candidate.authorize === "function"
  );
}

/** Verifies both the private brand and exact authorized facts before protected selection. */
export function matchesEventContentAuthorizationDecision(
  decision: EventContentAuthorizationDecision | undefined,
  request: EventContentAuthorizationRequest,
): decision is EventContentAuthorizationDecision {
  return (
    decision !== undefined &&
    hasEventContentAuthorizationDecision(decision) &&
    decision.authenticatedOwnerId === request.authenticatedOwnerId &&
    decision.eventOwnerId === request.eventOwnerId &&
    decision.privacy === request.privacy
  );
}
