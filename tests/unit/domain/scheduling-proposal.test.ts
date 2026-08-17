import { describe, expect, it } from "vitest";
import {
  assertCalendarApprovalOperation,
  createSchedulingProposal,
  SchedulingApprovalRequiredError,
} from "../../../src/domain/scheduling/proposal";

const BASE_INPUT = {
  proposalId: "proposal-1",
  title: "Focus block",
  durationMinutes: 60,
  preferredStartAt: "2026-08-20T20:00:00.000Z",
  window: {
    startsAt: "2026-08-20T20:00:00.000Z",
    endsAt: "2026-08-21T00:00:00.000Z",
    timeZone: "America/Chicago",
  },
  busyBlocks: [],
  sourceFacts: [],
  ambiguity: [],
  aiRequested: true,
};

describe("scheduling proposals", () => {
  it("marks a hard conflict and returns feasible alternatives with source citations", () => {
    const proposal = createSchedulingProposal({
      ...BASE_INPUT,
      busyBlocks: [{
        id: "event-busy",
        startsAt: "2026-08-20T20:00:00.000Z",
        endsAt: "2026-08-20T21:00:00.000Z",
        timeZone: "America/Chicago",
        busy: true,
        status: "confirmed",
        sourceFactId: "source:event-busy",
      }],
      sourceFacts: [{
        id: "source:event-busy",
        kind: "calendar_event",
        label: "Team review",
      }],
    });

    expect(proposal.status).toBe("conflict");
    expect(proposal.conflicts).toEqual([expect.objectContaining({
      blockId: "event-busy",
      sourceFactId: "source:event-busy",
    })]);
    expect(proposal.citations).toEqual([{
      sourceFactId: "source:event-busy",
      kind: "calendar_event",
      label: "Team review",
    }]);
    expect(proposal.alternatives[0]).toMatchObject({
      localStart: "2026-08-20 16:00",
      localEnd: "2026-08-20 17:00",
    });
    expect(proposal.calendarWrite).toMatchObject({
      authority: "approval-required",
      canConfirm: false,
      approvalOperationId: null,
    });
  });

  it("converts a requested UTC instant into the requested planning timezone", () => {
    const proposal = createSchedulingProposal({
      ...BASE_INPUT,
      preferredStartAt: "2026-08-20T14:00:00.000Z",
      window: {
        startsAt: "2026-08-20T14:00:00.000Z",
        endsAt: "2026-08-20T16:00:00.000Z",
        timeZone: "America/Chicago",
      },
    });

    expect(proposal.status).toBe("ready");
    expect(proposal.alternatives[0]).toMatchObject({
      startsAt: "2026-08-20T14:00:00.000Z",
      localStart: "2026-08-20 09:00",
      localEnd: "2026-08-20 10:00",
    });
    expect(proposal.automation).toEqual({
      mode: "deterministic",
      aiEnabled: false,
    });
  });

  it("does not guess when the request still has unresolved ambiguity", () => {
    const proposal = createSchedulingProposal({
      ...BASE_INPUT,
      ambiguity: ["timeZone", "durationMinutes"],
    });

    expect(proposal.status).toBe("needs_clarification");
    expect(proposal.ambiguity).toEqual(["timeZone", "durationMinutes"]);
    expect(proposal.alternatives).toEqual([]);
    expect(proposal.conflicts).toEqual([]);
  });

  it("requires an existing calendar approval operation before any write handoff", () => {
    const proposal = createSchedulingProposal(BASE_INPUT);

    expect(() => assertCalendarApprovalOperation(proposal, null))
      .toThrow(SchedulingApprovalRequiredError);
    expect(assertCalendarApprovalOperation(proposal, "calendar-op-1"))
      .toEqual({
        proposalId: "proposal-1",
        approvalOperationId: "calendar-op-1",
        canExecute: true,
      });
  });
});
