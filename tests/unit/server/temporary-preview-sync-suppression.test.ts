import { describe, expect, it, vi } from "vitest";
import {
  emitTemporarySyncSuppressionEvidence,
  resolveTemporarySyncSuppressionState,
} from "../../../src/server/webhooks/temporary-preview-sync-suppression";

const NOW = new Date("2026-07-30T20:00:00.000Z");
const ACTIVE_EXPIRY = "2026-07-30T20:05:00.000Z";
const ELAPSED_EXPIRY = "2026-07-30T20:00:00.000Z";
const INVALID_CONFIGURATION =
  "Temporary synchronization suppression configuration is invalid.";

describe("temporary preview synchronization suppression", () => {
  it.each([
    ["preview without a selector", { VISION_ENV: "preview" }],
    ["production without a selector", { VISION_ENV: "production" }],
    [
      "a different valid selector pair",
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: ACTIVE_EXPIRY,
      },
    ],
  ])("resolves %s as inactive", (_name, environment) => {
    expect(resolveTemporarySyncSuppressionState(NOW, environment)).toBe(
      "inactive",
    );
  });

  it("resolves an unexpired synchronization selector pair as active", () => {
    expect(
      resolveTemporarySyncSuppressionState(NOW, {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: ACTIVE_EXPIRY,
      }),
    ).toBe("active");
  });

  it.each([
    ["at the expiry instant", ELAPSED_EXPIRY],
    ["after the expiry instant", "2026-07-30T19:59:59.999Z"],
  ])("resolves a valid synchronization pair %s as expired", (_name, expiry) => {
    expect(
      resolveTemporarySyncSuppressionState(NOW, {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: expiry,
      }),
    ).toBe("expired");
  });

  it.each([
    [
      "selector without expiry",
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
      },
    ],
    [
      "expiry without selector",
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: ACTIVE_EXPIRY,
      },
    ],
    [
      "preview selector in production",
      {
        VISION_ENV: "production",
        PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: ACTIVE_EXPIRY,
      },
    ],
    [
      "unknown selector",
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "unknown",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: ACTIVE_EXPIRY,
      },
    ],
    [
      "noncanonical expiry",
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-30T20:05:00Z",
      },
    ],
  ])("rejects a malformed %s with one safe error", (_name, environment) => {
    expect(() =>
      resolveTemporarySyncSuppressionState(NOW, environment),
    ).toThrowError(INVALID_CONFIGURATION);
  });

  it("rejects an invalid execution clock with the same safe error", () => {
    expect(() =>
      resolveTemporarySyncSuppressionState(new Date(Number.NaN), {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: ACTIVE_EXPIRY,
      }),
    ).toThrowError(INVALID_CONFIGURATION);
  });

  it("emits one deeply frozen exact-key content-free terminal", () => {
    const write = vi.fn();

    emitTemporarySyncSuppressionEvidence(write);

    expect(write).toHaveBeenCalledOnce();
    const entry = write.mock.calls[0]![0];
    expect(entry).toEqual({
      action: "acceptance.sync-suppression",
      evidence: {
        evidenceType: "vision.sync-suppression/v1",
        outcome: "suppressed",
      },
    });
    expect(Object.keys(entry)).toEqual(["action", "evidence"]);
    expect(Object.keys(entry.evidence)).toEqual(["evidenceType", "outcome"]);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.evidence)).toBe(true);
  });
});
