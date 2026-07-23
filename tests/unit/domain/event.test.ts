import { describe, expect, it } from "vitest";
import { VisionEventSchema } from "../../../src/domain/events/event";

const event = {
  nodeId: "node_event_1",
  ownerId: "owner_1",
  identity: {
    sourceSystem: "calendar",
    sourceCalendarId: "calendar_1",
    sourceEventId: "event_1",
    sourceVersion: "00000000000000000001",
  },
  startsAt: "2026-07-22T09:00:00.000Z",
  endsAt: "2026-07-22T10:00:00.000Z",
  timeZone: "America/Chicago",
  busy: true,
  status: "confirmed",
  domain: "work",
  domainState: "confirmed",
  privacy: "private",
  version: 1,
} as const;

describe("VisionEventSchema", () => {
  it("accepts only a canonical fixed-width provider order key", () => {
    expect(VisionEventSchema.safeParse(event).success).toBe(true);
    for (const sourceVersion of ["2", "10", "etag-opaque", "0000000000000000000x"]) {
      expect(
        VisionEventSchema.safeParse({
          ...event,
          identity: { ...event.identity, sourceVersion },
        }).success,
      ).toBe(false);
    }
  });
  it("requires a complete provider identity", () => {
    const { identity: _identity, ...withoutIdentity } = event;
    expect(VisionEventSchema.safeParse(withoutIdentity).success).toBe(false);
    expect(VisionEventSchema.safeParse({ ...event, identity: { sourceSystem: "calendar" } }).success).toBe(false);
  });

  it("rejects unknown event fields", () => {
    expect(VisionEventSchema.safeParse({ ...event, unapproved: true }).success).toBe(false);
  });

  it("rejects an event that ends at or before it starts", () => {
    expect(VisionEventSchema.safeParse({ ...event, endsAt: event.startsAt }).success).toBe(false);
  });

  it("accepts valid privacy and domain-state combinations", () => {
    expect(VisionEventSchema.safeParse(event).success).toBe(true);
    expect(
      VisionEventSchema.safeParse({ ...event, domain: "unresolved", domainState: "unresolved", privacy: "planning" }).success,
    ).toBe(true);
    expect(VisionEventSchema.safeParse({ ...event, domainState: "inferred", privacy: "restricted" }).success).toBe(true);
  });

  it("rejects contradictory domain and domain-state combinations", () => {
    expect(VisionEventSchema.safeParse({ ...event, domain: "unresolved", domainState: "inferred" }).success).toBe(false);
    expect(VisionEventSchema.safeParse({ ...event, domainState: "unresolved" }).success).toBe(false);
  });
});
