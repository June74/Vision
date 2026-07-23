import { describe, expect, it } from "vitest";
import { EdgeSchema, validateEdge } from "../../../src/domain/graph/edge";
import { NodeEnvelopeSchema, type NodeEnvelope } from "../../../src/domain/graph/node";
import { resolvePrivacy } from "../../../src/domain/privacy/privacy";

const eventNode: NodeEnvelope = {
  id: "node_event_1",
  nodeType: "event",
  ownerId: "owner_1",
  domain: "work",
  domainState: "confirmed",
  privacy: "restricted",
  provenance: "user",
  lifecycle: "active",
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T00:00:00.000Z",
  validFrom: "2026-07-22T00:00:00.000Z",
  version: 1,
};

const calendarNode: NodeEnvelope = { ...eventNode, id: "node_calendar_1", nodeType: "calendar" };

describe("canonical graph contracts", () => {
  it("rejects unknown node types", () => {
    expect(NodeEnvelopeSchema.safeParse({ ...eventNode, nodeType: "unknown" }).success).toBe(false);
  });

  it("rejects a cross-owner edge", () => {
    const otherOwnerCalendar = { ...calendarNode, ownerId: "owner_2" };
    expect(() =>
      validateEdge(
        {
          id: "edge_1",
          relation: "event_in_calendar",
          sourceNodeId: eventNode.id,
          destinationNodeId: otherOwnerCalendar.id,
          sourceType: "event",
          destinationType: "calendar",
          origin: "user",
          lifecycle: "confirmed",
          privacy: "restricted",
          version: 1,
        },
        eventNode,
        otherOwnerCalendar,
      ),
    ).toThrow("same owner");
  });

  it("rejects invalid edge families", () => {
    expect(
      EdgeSchema.safeParse({
        id: "edge_1",
        relation: "event_in_calendar",
        sourceNodeId: "node_task_1",
        destinationNodeId: calendarNode.id,
        sourceType: "task",
        destinationType: "calendar",
        origin: "user",
        lifecycle: "confirmed",
        privacy: "private",
        version: 1,
      }).success,
    ).toBe(false);
  });

  it("does not let inferred privacy reduce protection or authorize sharing", () => {
    expect(
      resolvePrivacy({ current: "restricted", proposed: "planning", basis: "inference" }),
    ).toEqual({ level: "restricted", sharingAuthorized: false });
  });
});
