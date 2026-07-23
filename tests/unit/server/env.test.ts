import { describe, expect, it } from "vitest";
import { RuntimeEnvSchema } from "../../../src/server/env";

describe("RuntimeEnvSchema", () => {
  it("rejects a missing deployment environment", () => {
    expect(() => RuntimeEnvSchema.parse({})).toThrow();
  });

  it("accepts only a database URL authenticated as the vision application role", () => {
    expect(
      RuntimeEnvSchema.parse({
        VISION_ENV: "preview",
        DATABASE_URL: "postgresql://vision_app:secret@db.example.test/vision",
      }),
    ).toMatchObject({ VISION_ENV: "preview" });
  });

  it("rejects a privileged database URL without exposing its secret", () => {
    const privilegedUrl = "postgresql://neondb_owner:private-password@db.example.test/vision";

    expect(() => RuntimeEnvSchema.parse({ VISION_ENV: "production", DATABASE_URL: privilegedUrl })).toThrow(
      /vision_app/i,
    );
    expect(() => RuntimeEnvSchema.parse({ VISION_ENV: "production", DATABASE_URL: privilegedUrl })).not.toThrow(privilegedUrl);
  });
});
