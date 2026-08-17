import { describe, expect, it } from "vitest";
import { classifyCapture } from "../../../../src/domain/secretary/capture";

describe("classifyCapture", () => {
  it("turns explicit task and note prefixes into local items", () => {
    expect(classifyCapture("task: submit the research report")).toMatchObject({
      kind: "task",
      title: "submit the research report",
      ambiguity: "none",
      calendarProposal: null,
    });
    expect(classifyCapture("note: ask the advisor about the dataset")).toMatchObject({
      kind: "note",
      title: "ask the advisor about the dataset",
      ambiguity: "none",
      calendarProposal: null,
    });
  });

  it("keeps calendar candidates pending explicit approval", () => {
    expect(classifyCapture("calendar: dentist appointment Friday at 2")).toMatchObject({
      kind: "calendar_candidate",
      ambiguity: "none",
      calendarProposal: {
        action: "create",
        status: "pending_approval",
        requiresExplicitApproval: true,
        canConfirm: false,
      },
    });
  });

  it("does not guess an unprefixed capture", () => {
    expect(classifyCapture("remember to compare the two papers")).toMatchObject({
      kind: "ambiguous",
      ambiguity: "needs_clarification",
      calendarProposal: null,
    });
  });

  it("rejects blank or oversized content", () => {
    expect(() => classifyCapture(" ")).toThrow("Capture input is invalid.");
    expect(() => classifyCapture("x".repeat(8_193))).toThrow("Capture input is invalid.");
  });
});
