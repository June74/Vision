import { describe, expect, it } from "vitest";
import {
  assertPreviewAcceptanceLifetime,
  assertPreviewAcceptanceWindow,
  createPreviewAcceptanceDeadline,
  PREVIEW_ACCEPTANCE_BLOCKED_END_UTC_MINUTE,
  PREVIEW_ACCEPTANCE_BLOCKED_START_UTC_MINUTE,
  PREVIEW_ACCEPTANCE_MAX_LIFETIME_MINUTES,
} from "../../../scripts/validate-preview-acceptance-window";
import { RuntimeEnvSchema } from "../../../src/server/env";

const INVALID = "Preview acceptance timing is unavailable.";

describe("preview acceptance timing guard", () => {
  it("blocks any maximum candidate lifetime that intersects the recovery window", () => {
    expect(PREVIEW_ACCEPTANCE_BLOCKED_START_UTC_MINUTE).toBe(5 * 60 + 35);
    expect(PREVIEW_ACCEPTANCE_BLOCKED_END_UTC_MINUTE).toBe(6 * 60 + 35);
    expect(PREVIEW_ACCEPTANCE_MAX_LIFETIME_MINUTES).toBe(30);

    for (const instant of [
      "2026-07-29T05:05:00.001Z",
      "2026-07-29T05:34:59.999Z",
      "2026-07-29T05:35:00.000Z",
      "2026-07-29T06:05:00.000Z",
      "2026-07-29T06:34:59.999Z",
    ]) {
      expect(() => assertPreviewAcceptanceWindow(new Date(instant))).toThrow(
        INVALID,
      );
    }
  });

  it("admits maximum lifetimes wholly outside the fail-closed overlap window", () => {
    for (const instant of [
      "2026-07-29T05:05:00.000Z",
      "2026-07-29T06:35:00.000Z",
      "2026-07-29T23:50:00.000Z",
    ]) {
      expect(() =>
        assertPreviewAcceptanceWindow(new Date(instant)),
      ).not.toThrow();
    }
  });

  it("creates one canonical bounded deadline and rejects stale or overlong candidates", () => {
    const activatedAt = new Date("2026-07-29T04:00:00.000Z");
    const deadline = createPreviewAcceptanceDeadline(activatedAt);
    expect(deadline).toBe("2026-07-29T04:30:00.000Z");
    expect(() =>
      assertPreviewAcceptanceLifetime(
        new Date("2026-07-29T04:15:00.000Z"),
        deadline,
      ),
    ).not.toThrow();

    for (const [now, expiresAt] of [
      ["2026-07-29T04:30:00.000Z", deadline],
      ["2026-07-29T03:59:59.999Z", deadline],
      ["2026-07-29T05:34:59.999Z", "2026-07-29T05:35:00.001Z"],
      ["2026-07-29T04:15:00.000Z", "malformed"],
    ]) {
      expect(() =>
        assertPreviewAcceptanceLifetime(new Date(now), expiresAt),
      ).toThrow(INVALID);
    }
  });

  it("rejects invalid clock input without rendering it", () => {
    expect(() => assertPreviewAcceptanceWindow(new Date(Number.NaN))).toThrow(
      INVALID,
    );
  });

  it("requires the server-only deadline exactly with a preview selector", () => {
    const runtime = {
      VISION_ENV: "preview",
      DATABASE_URL: "postgresql://vision_app:sentinel@db.example.test/vision",
      KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      DATABASE_USAGE_WARNING_BYTES: "400000000",
      R2_USAGE_WARNING_BYTES: "8000000000",
      R2_USAGE_WARNING_OBJECTS: "100",
    };
    expect(() =>
      RuntimeEnvSchema.parse({
        ...runtime,
        PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
      }),
    ).toThrow(/configured together/u);
    expect(() =>
      RuntimeEnvSchema.parse({
        ...runtime,
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-29T04:30:00.000Z",
      }),
    ).toThrow(/configured together/u);
    expect(() =>
      RuntimeEnvSchema.parse({
        ...runtime,
        PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-29T04:30:00.000Z",
      }),
    ).not.toThrow();
  });
});
