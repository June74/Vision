import { describe, expect, it } from "vitest";
import {
  assertPreviewAcceptanceWindow,
  PREVIEW_ACCEPTANCE_BLOCKED_END_UTC_MINUTE,
  PREVIEW_ACCEPTANCE_BLOCKED_START_UTC_MINUTE,
} from "../../../scripts/validate-preview-acceptance-window";

describe("preview acceptance timing guard", () => {
  it("blocks the complete recovery overlap window around 06:05 UTC", () => {
    expect(PREVIEW_ACCEPTANCE_BLOCKED_START_UTC_MINUTE).toBe(5 * 60 + 35);
    expect(PREVIEW_ACCEPTANCE_BLOCKED_END_UTC_MINUTE).toBe(6 * 60 + 35);

    for (const instant of [
      "2026-07-29T05:35:00.000Z",
      "2026-07-29T06:04:59.999Z",
      "2026-07-29T06:05:00.000Z",
      "2026-07-29T06:34:59.999Z",
    ]) {
      expect(() => assertPreviewAcceptanceWindow(new Date(instant))).toThrow(
        "Preview acceptance timing is unavailable.",
      );
    }
  });

  it("admits instants outside the fail-closed overlap window", () => {
    for (const instant of [
      "2026-07-29T05:34:59.999Z",
      "2026-07-29T06:35:00.000Z",
      "2026-07-29T12:00:00.000Z",
    ]) {
      expect(() => assertPreviewAcceptanceWindow(new Date(instant))).not.toThrow();
    }
  });

  it("rejects invalid clock input without rendering it", () => {
    expect(() => assertPreviewAcceptanceWindow(new Date(Number.NaN))).toThrow(
      "Preview acceptance timing is unavailable.",
    );
  });
});
