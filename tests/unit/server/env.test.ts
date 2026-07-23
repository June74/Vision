import { describe, expect, it } from "vitest";
import { RuntimeEnvSchema } from "../../../src/server/env";

function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

describe("RuntimeEnvSchema", () => {
  it("rejects a missing deployment environment", () => {
    expect(() => RuntimeEnvSchema.parse({})).toThrow();
  });

  it("accepts only a database URL authenticated as the vision application role", () => {
    expect(
      RuntimeEnvSchema.parse({
        VISION_ENV: "preview",
        DATABASE_URL: "postgresql://vision_app:secret@db.example.test/vision",
        KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      }),
    ).toMatchObject({ VISION_ENV: "preview" });
  });

  it("rejects a privileged database URL without exposing its secret", () => {
    const privilegedUrl = "postgresql://neondb_owner:private-password@db.example.test/vision";

    const environment = {
      VISION_ENV: "production",
      DATABASE_URL: privilegedUrl,
      KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    };

    expect(() => RuntimeEnvSchema.parse(environment)).toThrow(/vision_app/i);
    expect(() => RuntimeEnvSchema.parse(environment)).not.toThrow(privilegedUrl);
  });

  it("accepts only a canonical unpadded base64url 256-bit root wrapping key", () => {
    const environment = {
      VISION_ENV: "production",
      DATABASE_URL: "postgresql://vision_app:secret@db.example.test/vision",
    };

    const finalCharacters = new Set<string>();
    for (let finalNibble = 0; finalNibble < 16; finalNibble += 1) {
      const bytes = new Uint8Array(32);
      bytes[31] = finalNibble;
      const encoded = encodeBase64Url(bytes);
      finalCharacters.add(encoded.at(-1) as string);
      expect(() => RuntimeEnvSchema.parse({ ...environment, KEY_ENCRYPTION_KEY: encoded })).not.toThrow();
    }

    expect([...finalCharacters].join("")).toBe("AEIMQUYcgkosw048");
    expect(() => RuntimeEnvSchema.parse({ ...environment, KEY_ENCRYPTION_KEY: "too-short" })).toThrow(
      /256-bit base64url/u,
    );
    expect(() =>
      RuntimeEnvSchema.parse({
        ...environment,
        KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB",
      }),
    ).toThrow(/256-bit base64url/u);
    expect(() =>
      RuntimeEnvSchema.parse({
        ...environment,
        KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      }),
    ).toThrow(/256-bit base64url/u);
    expect(() =>
      RuntimeEnvSchema.parse({
        ...environment,
        KEY_ENCRYPTION_KEY: "secret-root-key-that-must-never-appear-in-errors",
      }),
    ).not.toThrow(/secret-root-key-that-must-never-appear-in-errors/u);
  });
});
