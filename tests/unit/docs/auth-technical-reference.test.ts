import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const references = [
  "docs/reference/technical/src/data/repositories/session-repository.md",
  "docs/reference/technical/src/data/repositories/token-repository.md",
  "docs/reference/technical/src/integrations/google/oauth-client.md",
  "docs/reference/technical/src/server/auth/admission.md",
  "docs/reference/technical/src/server/auth/csrf.md",
  "docs/reference/technical/src/server/auth/oauth-routes.md",
  "docs/reference/technical/src/server/auth/session.md",
  "docs/reference/technical/src/server/env.md",
  "docs/reference/technical/src/worker.md",
] as const;

const semanticSections = [
  "Signatures",
  "Dependencies",
  "Inputs and outputs",
  "Side effects",
  "Failure behavior",
  "Privacy and authorization",
  "Covering tests",
] as const;

describe("authentication technical reference contract", () => {
  it.each(references)("%s carries the complete semantic maintenance contract", (path) => {
    const reference = readFileSync(resolve(process.cwd(), path), "utf8");

    for (const section of semanticSections) {
      expect(reference, `${path} missing ${section}`).toMatch(
        new RegExp(`^## ${section}$`, "mu"),
      );
    }
    expect(reference).toMatch(/```(?:ts|typescript)\r?\n[\s\S]*\([^)]*\)[\s\S]*```/u);
    expect(reference).toMatch(
      /tests\/(?:contract|integration|unit|worker)\/[A-Za-z0-9_./-]+\.test\.ts/u,
    );
  });
});
