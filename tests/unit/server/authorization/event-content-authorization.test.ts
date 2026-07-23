import { describe, expect, it } from "vitest";
import {
  createEventContentAuthorizationPolicy,
  matchesEventContentAuthorizationDecision,
  type EventContentAuthorizationDecision,
} from "../../../../src/server/authorization/event-content-authorization";

const request = {
  authenticatedOwnerId: "owner_1",
  eventOwnerId: "owner_1",
  privacy: "private",
} as const;

describe("event content authorization policy", () => {
  it("issues a verifiable decision only for the authenticated owner and allowed privacy", () => {
    const policy = createEventContentAuthorizationPolicy(
      (_ownerId, privacy) => privacy === "private",
    );

    const decision = policy.authorize(request);

    expect(matchesEventContentAuthorizationDecision(decision, request)).toBe(true);
    expect(
      policy.authorize({ ...request, eventOwnerId: "owner_2" }),
    ).toBeUndefined();
    expect(
      policy.authorize({ ...request, privacy: "restricted" }),
    ).toBeUndefined();
  });

  it("rejects a caller-forged ordinary object without the private runtime brand", () => {
    const forged = {
      authenticatedOwnerId: "owner_1",
      eventOwnerId: "owner_1",
      privacy: "private",
    } as EventContentAuthorizationDecision;

    expect(matchesEventContentAuthorizationDecision(forged, request)).toBe(false);
  });
});
