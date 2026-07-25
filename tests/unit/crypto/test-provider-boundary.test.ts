import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TEST_PROVIDER_BOUNDARY_MARKER,
  validateProductionCryptoBoundary,
} from "../../../scripts/validate-production-crypto-boundary";

describe("production crypto build boundary", () => {
  it("keeps test-only key and authorization issuers unreachable from production source and bundles", () => {
    expect(validateProductionCryptoBoundary(resolve(import.meta.dirname, "../../.."))).toEqual([]);
    expect(TEST_PROVIDER_BOUNDARY_MARKER).toMatch(/TEST_PROVIDER/u);
  });

  it("keeps deletion implementations private to their capability-validating factories", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../../../src/data/repositories/deletion-repository.ts"),
      "utf8",
    );
    expect(source).not.toContain("export class DrizzleDeletionRepository");
    expect(source).not.toContain("export class DrizzleDeletionPurgeRepository");
  });

  it("keeps the production AI issuer behind the event authorization verifier", () => {
    const routeSource = readFileSync(
      resolve(import.meta.dirname, "../../../src/server/api/ai-category-proposal-routes.ts"),
      "utf8",
    );
    const verifierSource = readFileSync(
      resolve(import.meta.dirname, "../../../src/server/authorization/event-content-authorization.ts"),
      "utf8",
    );

    expect(routeSource).toContain(
      'from "../authorization/event-content-authorization"',
    );
    expect(routeSource).not.toContain("event-content-capability-internal");
    expect(verifierSource).toContain(
      "export function createAiEventRepositoryAccess",
    );
  });

  it("keeps production diagnostics behind the event authorization verifier", () => {
    const routeSource = readFileSync(
      resolve(import.meta.dirname, "../../../src/server/api/diagnostic-routes.ts"),
      "utf8",
    );
    const repositorySource = readFileSync(
      resolve(import.meta.dirname, "../../../src/data/repositories/diagnostic-repository.ts"),
      "utf8",
    );

    expect(routeSource).toContain(
      'from "../authorization/event-content-authorization"',
    );
    expect(routeSource).toContain("createAiEventRepositoryAccess");
    expect(routeSource).not.toContain("event-content-capability-internal");
    expect(repositorySource).toContain("isVerifiedEventRepositoryAccess");
    expect(repositorySource).toContain(
      "matchesEventContentAuthorizationDecision",
    );
    expect(repositorySource).not.toContain("event-content-capability-internal");
  });
});
