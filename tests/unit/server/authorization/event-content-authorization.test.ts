import { describe, expect, it } from "vitest";
import {
  isVerifiedEventRepositoryAccess,
  matchesEventContentAuthorizationDecision,
  type EventContentAuthorizationDecision,
  type VerifiedEventRepositoryAccess,
} from "../../../../src/server/authorization/event-content-authorization";
import { createTestEventRepositoryAccess } from "../../../../src/server/authorization/test-event-content-authorization";
import type { KeyProvider } from "../../../../src/crypto/key-provider";
import type { VisionDatabase } from "../../../../src/data/db";
import {
  EventOwnerMismatchError,
  createEventRepository,
} from "../../../../src/data/repositories/event-repository";

const request = {
  authenticatedOwnerId: "owner_1",
  eventOwnerId: "owner_1",
  privacy: "private",
} as const;

describe("event content authorization capability", () => {
  it("issues a verifiable decision only for the verified owner and allowed privacy", () => {
    const access = createTestEventRepositoryAccess(
      "owner_1",
      ({ privacy }) => privacy === "private",
    );

    expect(isVerifiedEventRepositoryAccess(access)).toBe(true);
    expect(
      matchesEventContentAuthorizationDecision(access.authorize(request), request),
    ).toBe(true);
    expect(access.authorize({ ...request, eventOwnerId: "owner_2" })).toBeUndefined();
    expect(access.authorize({ ...request, privacy: "restricted" })).toBeUndefined();
  });

  it("rejects caller-forged access and decision objects", () => {
    const forgedAccess = {
      authenticatedOwnerId: "owner_1",
      authorize: () => undefined,
    } as unknown as VerifiedEventRepositoryAccess;
    const forgedDecision = {
      authenticatedOwnerId: "owner_1",
      eventOwnerId: "owner_1",
      privacy: "private",
    } as EventContentAuthorizationDecision;

    expect(isVerifiedEventRepositoryAccess(forgedAccess)).toBe(false);
    expect(matchesEventContentAuthorizationDecision(forgedDecision, request)).toBe(false);
    expect(() =>
      createEventRepository(
        {} as VisionDatabase,
        {} as KeyProvider,
        forgedAccess,
      ),
    ).toThrow(EventOwnerMismatchError);
  });

  it("does not transfer authority when every discoverable property is reflectively copied", () => {
    const access = createTestEventRepositoryAccess("owner_1");
    const decision = access.authorize(request)!;
    const copiedAccess = Object.defineProperties(
      {},
      Object.getOwnPropertyDescriptors(access),
    ) as unknown as VerifiedEventRepositoryAccess;
    const copiedDecision = Object.defineProperties(
      {},
      Object.getOwnPropertyDescriptors(decision),
    ) as EventContentAuthorizationDecision;

    expect(isVerifiedEventRepositoryAccess(copiedAccess)).toBe(false);
    expect(matchesEventContentAuthorizationDecision(copiedDecision, request)).toBe(false);
  });
});
