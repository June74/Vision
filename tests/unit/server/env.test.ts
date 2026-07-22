import { describe, expect, it } from "vitest";
import { RuntimeEnvSchema } from "../../../src/server/env";

describe("RuntimeEnvSchema", () => {
  it("rejects a missing deployment environment", () => {
    expect(() => RuntimeEnvSchema.parse({})).toThrow();
  });
});
