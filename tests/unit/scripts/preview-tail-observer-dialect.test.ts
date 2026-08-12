import { describe, expect, it } from "vitest";
import {
  PREVIEW_TAIL_OBSERVER_FAILURE_CATEGORIES,
  parsePreviewTailObserverFailureMarker,
} from "../../../scripts/preview-tail-observer-dialect";

const marker = (category: string): string =>
  `Preview tail observer failed closed: ${category}.`;

describe("preview tail observer dialect", () => {
  it("admits every current fixed category", () => {
    for (const category of PREVIEW_TAIL_OBSERVER_FAILURE_CATEGORIES) {
      expect(
        parsePreviewTailObserverFailureMarker(`${marker(category)}\n`),
      ).toBe(category);
    }
  });

  it.each([
    "maintenance_unknown",
    "Preview tail observer failed closed: observer_runtime_error extra",
    "Preview tail observer failed closed: observer_runtime_error;secret.",
    "Preview tail observer failed closed: observer_runtime_error",
    "xPreview tail observer failed closed: observer_runtime_error.",
    "Preview tail observer failed closed: observer_runtime_error.extra",
  ])("rejects malformed or unknown marker %j", (input) => {
    expect(parsePreviewTailObserverFailureMarker(input)).toBeNull();
  });

  it("accepts LF and CRLF complete lines", () => {
    expect(
      parsePreviewTailObserverFailureMarker(
        "prefix\nPreview tail observer failed closed: maintenance_outcome_mismatch.\n",
      ),
    ).toBe("maintenance_outcome_mismatch");
    expect(
      parsePreviewTailObserverFailureMarker(
        "Preview tail observer failed closed: maintenance_outcome_mismatch.\r\n",
      ),
    ).toBe("maintenance_outcome_mismatch");
  });

  it("rejects input over the 128-byte protocol bound", () => {
    const oversized = `${"x".repeat(90)}\n${marker("observer_runtime_error")}\n`;
    expect(parsePreviewTailObserverFailureMarker(oversized)).toBeNull();
  });
});
