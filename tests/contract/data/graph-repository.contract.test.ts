import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositorySource = readFileSync(resolve(process.cwd(), "src/data/repositories/graph-repository.ts"), "utf8");

describe("GraphRepository ownership and data-minimization guards", () => {
  it("upserts nodes by owner-scoped natural identity and guards both owner and stable ID", () => {
    expect(repositorySource).toContain("target: [nodes.ownerId, nodes.provider, nodes.providerNodeId]");
    expect(repositorySource).toContain("eq(nodes.ownerId, node.ownerId)");
    expect(repositorySource).toContain("eq(nodes.id, node.id)");
    expect(repositorySource).toContain("GraphIdentityConflictError");
    expect(repositorySource).toContain("return \"no_newer_version\"");
    expect(repositorySource).toContain(".returning({ id: nodes.id })");
  });

  it("updates a provider event only for its existing owner and never sets owner during conflict resolution", () => {
    const eventUpdate = repositorySource.slice(repositorySource.indexOf("async upsertEvent"), repositorySource.indexOf("async replaceEdges"));

    expect(eventUpdate).toContain("eq(events.ownerId, event.ownerId)");
    const conflictSet = eventUpdate.slice(eventUpdate.indexOf("set:"), eventUpdate.indexOf("where:"));
    expect(conflictSet).not.toContain("ownerId:");
    expect(eventUpdate).toContain("Provider event identity is already owned by another account.");
    expect(eventUpdate).toContain(".returning({ nodeId: events.nodeId })");
  });

  it("loads only planning-safe event columns and documents the required existing node", () => {
    const lookup = repositorySource.slice(repositorySource.indexOf("async getEventByProviderIdentity"));

    expect(lookup).toContain(".select({");
    expect(lookup).not.toMatch(/titleEnvelope|descriptionEnvelope|attendeesEnvelope|locationEnvelope|meetingLinkEnvelope/);
    expect(repositorySource).toMatch(/pre-existing same-owner event node/i);
  });
});
