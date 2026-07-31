import { describe, expect, it } from "vitest";
import {
  assertPreviewAcceptanceLifetime,
  assertPreviewAcceptanceWindow,
  createPreviewAcceptanceDeadline,
  previewAcceptanceMaxLifetimeMinutes,
  PREVIEW_ACCEPTANCE_BLOCKED_END_UTC_MINUTE,
  PREVIEW_ACCEPTANCE_BLOCKED_START_UTC_MINUTE,
  PREVIEW_ACCEPTANCE_MAX_LIFETIME_MINUTES,
} from "../../../scripts/validate-preview-acceptance-window";
import { RuntimeEnvSchema } from "../../../src/server/env";
import {
  assertAiRollbackAvoidsPermanentSchedules,
  assertPreviewAiRequestMargin,
  createPreviewAiEvidenceWindow,
  parseTemporaryPreviewAiEvidenceWindow,
} from "../../../src/domain/operations/temporary-preview-fault";

const INVALID = "Preview acceptance timing is unavailable.";

describe("preview acceptance timing guard", () => {
  it("creates one frozen exact 30-minute AI window and shifts only generated minute equality", () => {
    const exact = createPreviewAiEvidenceWindow(
      new Date("2026-07-29T04:00:00.000Z"),
    );
    expect(exact).toEqual({
      activatedAt: new Date("2026-07-29T04:00:00.001Z"),
      evidenceScheduledAt: new Date("2026-07-29T04:30:00.000Z"),
      expiresAt: new Date("2026-07-29T04:30:00.001Z"),
    });
    expect(exact.expiresAt.getTime() - exact.activatedAt.getTime()).toBe(
      30 * 60_000,
    );
    expect(Object.isFrozen(exact)).toBe(true);

    const ordinary = createPreviewAiEvidenceWindow(
      new Date("2026-07-29T04:00:00.250Z"),
    );
    expect(ordinary.activatedAt.toISOString()).toBe(
      "2026-07-29T04:00:00.250Z",
    );
    expect(ordinary.evidenceScheduledAt.toISOString()).toBe(
      "2026-07-29T04:30:00.000Z",
    );
    expect(ordinary.expiresAt.toISOString()).toBe(
      "2026-07-29T04:30:00.250Z",
    );
  });

  it("parses only a strict own-scalar AI window and returns independent Date snapshots", () => {
    const environment = {
      VISION_ENV: "preview",
      PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
      PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT:
        "2026-07-29T04:30:00.000Z",
      PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-29T04:30:00.250Z",
    };
    const parsed = parseTemporaryPreviewAiEvidenceWindow(environment);
    expect(parsed).toEqual({
      activatedAt: new Date("2026-07-29T04:00:00.250Z"),
      evidenceScheduledAt: new Date("2026-07-29T04:30:00.000Z"),
      expiresAt: new Date("2026-07-29T04:30:00.250Z"),
    });
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(parsed?.expiresAt).not.toBe(environment.PREVIEW_ACCEPTANCE_EXPIRES_AT);

    expect(() =>
      parseTemporaryPreviewAiEvidenceWindow({
        ...environment,
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-29T04:30:00.000Z",
      }),
    ).toThrow("Temporary preview AI evidence window is invalid.");
    expect(() =>
      parseTemporaryPreviewAiEvidenceWindow({
        ...environment,
        PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
      }),
    ).toThrow("Temporary preview AI evidence window is invalid.");
  });

  it("rejects inherited and non-enumerable AI-window bindings", () => {
    const inherited = Object.create({
      VISION_ENV: "preview",
      PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
      PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT:
        "2026-07-29T04:30:00.000Z",
      PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-29T04:30:00.250Z",
    }) as unknown;
    const hidden = {
      VISION_ENV: "preview",
      PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
      PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT:
        "2026-07-29T04:30:00.000Z",
    };
    Object.defineProperty(hidden, "PREVIEW_ACCEPTANCE_EXPIRES_AT", {
      enumerable: false,
      value: "2026-07-29T04:30:00.250Z",
    });

    for (const candidate of [inherited, hidden]) {
      expect(() => parseTemporaryPreviewAiEvidenceWindow(candidate)).toThrow(
        "Temporary preview AI evidence window is invalid.",
      );
    }
  });

  it("rejects AI-window accessors without invoking them", () => {
    let calls = 0;
    const accessor = {
      VISION_ENV: "preview",
      PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
      PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT:
        "2026-07-29T04:30:00.000Z",
      get PREVIEW_ACCEPTANCE_EXPIRES_AT(): string {
        calls += 1;
        return "2026-07-29T04:30:00.250Z";
      },
    };

    expect(() => parseTemporaryPreviewAiEvidenceWindow(accessor)).toThrow(
      "Temporary preview AI evidence window is invalid.",
    );
    expect(calls).toBe(0);
  });

  it("normalizes hostile proxy failures at the AI-window parser boundary", () => {
    const hostile = new Proxy(
      {},
      {
        getOwnPropertyDescriptor: () => {
          throw new Error("hostile trap detail");
        },
      },
    );

    expect(() => parseTemporaryPreviewAiEvidenceWindow(hostile)).toThrow(
      "Temporary preview AI evidence window is invalid.",
    );
  });

  it("accepts the exact 90,000-millisecond live-request margin", () => {
    const evidenceScheduledAt = new Date("2026-07-29T04:30:00.000Z");
    expect(() =>
      assertPreviewAiRequestMargin(
        new Date(evidenceScheduledAt.getTime() - 90_000),
        evidenceScheduledAt,
      ),
    ).not.toThrow();
    expect(() =>
      assertPreviewAiRequestMargin(
        new Date(evidenceScheduledAt.getTime() - 89_999),
        evidenceScheduledAt,
      ),
    ).toThrow(INVALID);
  });

  it("rejects AI windows crossing the Chicago month or post-expiry permanent schedule bound", () => {
    expect(() =>
      createPreviewAiEvidenceWindow(
        new Date("2026-08-01T04:45:00.250Z"),
      ),
    ).toThrow("Preview acceptance timing is unavailable.");

    expect(() =>
      createPreviewAiEvidenceWindow(
        new Date("2026-07-29T04:43:59.999Z"),
      ),
    ).not.toThrow();
    expect(() =>
      createPreviewAiEvidenceWindow(
        new Date("2026-07-29T04:44:00.000Z"),
      ),
    ).toThrow("Preview acceptance timing is unavailable.");
  });

  it("isolates the daily 06:05 schedule at the post-expiry 60-second boundary", () => {
    const dailySchedule = Date.parse("2026-07-29T06:05:00.000Z");
    expect(() =>
      assertAiRollbackAvoidsPermanentSchedules(
        new Date(dailySchedule - 60_000),
      ),
    ).not.toThrow();
    expect(() =>
      assertAiRollbackAvoidsPermanentSchedules(
        new Date(dailySchedule - 59_999),
      ),
    ).toThrow(INVALID);
  });

  it("isolates a quarter-hour schedule at the post-expiry 60-second boundary", () => {
    const quarterHourSchedule = Date.parse("2026-07-29T05:15:00.000Z");
    expect(() =>
      assertAiRollbackAvoidsPermanentSchedules(
        new Date(quarterHourSchedule - 60_000),
      ),
    ).not.toThrow();
    expect(() =>
      assertAiRollbackAvoidsPermanentSchedules(
        new Date(quarterHourSchedule - 59_999),
      ),
    ).toThrow(INVALID);
  });
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
      expect(() =>
        assertPreviewAcceptanceWindow(new Date(instant), "ai_usage"),
      ).toThrow(INVALID);
    }
  });

  it("admits maximum lifetimes wholly outside the fail-closed overlap window", () => {
    for (const instant of [
      "2026-07-29T05:05:00.000Z",
      "2026-07-29T06:35:00.000Z",
      "2026-07-29T23:50:00.000Z",
    ]) {
      expect(() =>
        assertPreviewAcceptanceWindow(new Date(instant), "ai_usage"),
      ).not.toThrow();
    }
  });

  it("creates one canonical bounded deadline and rejects stale or overlong candidates", () => {
    const activatedAt = new Date("2026-07-29T04:00:00.000Z");
    const deadline = createPreviewAcceptanceDeadline(activatedAt, "ai_usage");
    expect(deadline).toBe("2026-07-29T04:30:00.000Z");
    expect(() =>
      assertPreviewAcceptanceLifetime(
        new Date("2026-07-29T04:15:00.000Z"),
        deadline,
        "ai_usage",
      ),
    ).not.toThrow();

    for (const [now, expiresAt] of [
      ["2026-07-29T04:30:00.000Z", deadline],
      ["2026-07-29T03:59:59.999Z", deadline],
      ["2026-07-29T05:34:59.999Z", "2026-07-29T05:35:00.001Z"],
      ["2026-07-29T04:15:00.000Z", "malformed"],
    ]) {
      expect(() =>
        assertPreviewAcceptanceLifetime(new Date(now), expiresAt, "ai_usage"),
      ).toThrow(INVALID);
    }
  });

  it("rejects invalid clock input without rendering it", () => {
    expect(() =>
      assertPreviewAcceptanceWindow(new Date(Number.NaN), "ai_usage"),
    ).toThrow(INVALID);
    expect(() =>
      createPreviewAcceptanceDeadline(
        new Date(Number.NaN),
        "sync_suppression",
      ),
    ).toThrow(INVALID);
  });

  it("enforces the exact ten-minute suppression lifetime and canonical UTC expiry", () => {
    const activatedAt = new Date("2026-07-29T04:00:00.000Z");
    const deadline = createPreviewAcceptanceDeadline(
      activatedAt,
      "sync_suppression",
    );

    expect(previewAcceptanceMaxLifetimeMinutes("sync_suppression")).toBe(10);
    expect(deadline).toBe("2026-07-29T04:10:00.000Z");
    expect(() =>
      assertPreviewAcceptanceLifetime(
        activatedAt,
        deadline,
        "sync_suppression",
      ),
    ).not.toThrow();
    expect(() =>
      assertPreviewAcceptanceLifetime(
        activatedAt,
        "2026-07-29T04:10:00.001Z",
        "sync_suppression",
      ),
    ).toThrow(INVALID);
  });

  it("checks the whole selector-specific lifetime against recovery", () => {
    expect(() =>
      assertPreviewAcceptanceWindow(
        new Date("2026-07-29T05:25:00.000Z"),
        "sync_suppression",
      ),
    ).not.toThrow();
    expect(() =>
      assertPreviewAcceptanceWindow(
        new Date("2026-07-29T05:25:00.001Z"),
        "sync_suppression",
      ),
    ).toThrow(INVALID);
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
