import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertAiPricingDeployArtifact,
  readProvisionedAiPricingPolicy,
} from "../../../scripts/attest-ai-pricing-policy";
import {
  AI_PRICING_POLICY_VALUES,
  type AiPricingBindingName,
} from "../../../src/server/ai-pricing-binding-contract";
import {
  CLIENT_SAFE_RUNTIME_BINDING_NAMES,
  RUNTIME_CLIENT_FORBIDDEN_BINDING_NAMES,
} from "../../../src/server/client-binding-boundary";

function artifact(environment: "preview" | "production") {
  return {
    targetEnvironment: environment,
    vars: {
      VISION_ENV: environment,
      ...AI_PRICING_POLICY_VALUES,
    },
  };
}

describe("AI pricing policy deploy attestation", () => {
  it.each(["preview", "production"] as const)(
    "accepts the exact %s artifact without returning policy values",
    (environment) => {
      expect(
        assertAiPricingDeployArtifact(artifact(environment), environment),
      ).toBeUndefined();
    },
  );

  it.each(Object.keys(AI_PRICING_POLICY_VALUES) as AiPricingBindingName[])(
    "rejects missing or stale artifact binding %s",
    (name) => {
      const missing = artifact("preview");
      delete (missing.vars as Record<string, unknown>)[name];
      expect(() =>
        assertAiPricingDeployArtifact(missing, "preview"),
      ).toThrow("AI pricing policy attestation is invalid.");

      expect(() =>
        assertAiPricingDeployArtifact(
          {
            ...artifact("preview"),
            vars: {
              ...artifact("preview").vars,
              [name]: String(Number(AI_PRICING_POLICY_VALUES[name]) + 1),
            },
          },
          "preview",
        ),
      ).toThrow("AI pricing policy attestation is invalid.");
    },
  );

  it.each([
    ["wrong environment", artifact("production"), "preview"],
    [
      "malformed",
      {
        ...artifact("preview"),
        vars: {
          ...artifact("preview").vars,
          AI_ROUTINE_WORST_CASE_CENTS: "010",
        },
      },
      "preview",
    ],
    [
      "wrong type",
      {
        ...artifact("preview"),
        vars: {
          ...artifact("preview").vars,
          AI_ROUTINE_WORST_CASE_CENTS: 10,
        },
      },
      "preview",
    ],
    [
      "arbitrary",
      {
        ...artifact("preview"),
        vars: {
          ...artifact("preview").vars,
          AI_ROUTINE_WORST_CASE_CENTS: "99999",
        },
      },
      "preview",
    ],
  ])("rejects %s artifact policy", (_label, candidate, environment) => {
    expect(() =>
      assertAiPricingDeployArtifact(candidate, environment),
    ).toThrow("AI pricing policy attestation is invalid.");
  });

  it("provisions the same exact policy in local, preview, and production source config", async () => {
    const config = JSON.parse(
      await readFile(resolve(process.cwd(), "wrangler.jsonc"), "utf8"),
    ) as unknown;

    expect(readProvisionedAiPricingPolicy(config, "local")).toEqual(
      AI_PRICING_POLICY_VALUES,
    );
    expect(readProvisionedAiPricingPolicy(config, "preview")).toEqual(
      AI_PRICING_POLICY_VALUES,
    );
    expect(readProvisionedAiPricingPolicy(config, "production")).toEqual(
      AI_PRICING_POLICY_VALUES,
    );
  });

  it("keeps every policy binding server-only", () => {
    for (const name of Object.keys(
      AI_PRICING_POLICY_VALUES,
    ) as AiPricingBindingName[]) {
      expect(RUNTIME_CLIENT_FORBIDDEN_BINDING_NAMES).toContain(name);
      expect(CLIENT_SAFE_RUNTIME_BINDING_NAMES).not.toContain(name);
    }
  });
});
