import { describe, expect, it } from "vitest";
import {
  validatePreviewObserverState,
  type PreviewObserverEvidence,
} from "../../../scripts/validate-preview-observer-state";
import { PREVIEW_OBSERVER_JOB_CONTRACT } from "../../../scripts/resolve-preview-observer-run";

const SHA = "a".repeat(40);
const LISTENER_STEP = "Print only allowlisted acceptance evidence";

function validState(evidence: PreviewObserverEvidence = "preview_fault") {
  return {
    expectedSha: SHA,
    evidence,
    runResponse: {
      event: "workflow_dispatch",
      status: "in_progress",
      conclusion: null,
      head_sha: SHA,
      path: ".github/workflows/preview.yml",
    },
    jobsResponse: {
      jobs: [
        {
          name: PREVIEW_OBSERVER_JOB_CONTRACT[evidence][0],
          status: "in_progress",
          conclusion: null,
          steps: [
            {
              name: "Set up job",
              status: "completed",
              conclusion: "success",
            },
            {
              name: LISTENER_STEP,
              status: "in_progress",
              conclusion: null,
            },
          ],
        },
      ],
    },
  };
}

describe("preview observer state validation", () => {
  it.each([
    "calendar_maintenance",
    "foundation_probe",
    "ai_usage",
    "preview_fault",
    "role_probe",
  ] as const)("accepts only the exact active %s listener step", (evidence) => {
    expect(() => validatePreviewObserverState(validState(evidence))).not.toThrow();
  });

  it.each(["sync_suppression", "restore"] as const)(
    "requires signal plus uniqueness listeners for %s",
    (evidence) => {
      const input = validState(evidence);
      input.jobsResponse.jobs = [
        {
          name: `Capture ${evidence} signal`,
          status: "in_progress",
          conclusion: null,
          steps: [
            {
              name: LISTENER_STEP,
              status: "in_progress",
              conclusion: null,
            },
          ],
        },
        {
          name: `Capture ${evidence} uniqueness`,
          status: "in_progress",
          conclusion: null,
          steps: [
            {
              name: LISTENER_STEP,
              status: "in_progress",
              conclusion: null,
            },
          ],
        },
      ];
      expect(() => validatePreviewObserverState(input)).not.toThrow();
      input.jobsResponse.jobs.pop();
      expect(() => validatePreviewObserverState(input)).toThrow(
        "Preview observer state is invalid.",
      );
    },
  );

  it("requires maintenance uniqueness only at the exact canonical scheduled instant", () => {
    const input: any = {
      ...validState("calendar_maintenance"),
      maintenanceScheduledAt: "2026-07-30T18:15:00.000Z",
    };
    input.jobsResponse.jobs = [
      {
        name: "Capture calendar_maintenance uniqueness",
        status: "in_progress",
        conclusion: null,
        maintenanceScheduledAt: "2026-07-30T18:15:00.000Z",
        steps: [
          {
            name: LISTENER_STEP,
            status: "in_progress",
            conclusion: null,
          },
        ],
      },
    ];
    expect(() => validatePreviewObserverState(input)).not.toThrow();
    input.jobsResponse.jobs.push({
      ...input.jobsResponse.jobs[0]!,
      name: "Capture calendar_maintenance signal",
    });
    expect(() => validatePreviewObserverState(input)).toThrow(
      "Preview observer state is invalid.",
    );
  });

  it.each([
    ["queued", "queued", null],
    ["completed", "completed", "success"],
    ["cancelled", "completed", "cancelled"],
  ] as const)("rejects a %s listener step", (_label, status, conclusion) => {
    const input = validState();
    input.jobsResponse.jobs[0]!.steps[1] = {
      name: LISTENER_STEP,
      status,
      conclusion,
    };

    expect(() => validatePreviewObserverState(input)).toThrow(
      "Preview observer state is invalid.",
    );
  });

  it("rejects an absent or duplicated listener step", () => {
    const absent = validState();
    absent.jobsResponse.jobs[0]!.steps = absent.jobsResponse.jobs[0]!.steps.slice(
      0,
      1,
    );
    expect(() => validatePreviewObserverState(absent)).toThrow(
      "Preview observer state is invalid.",
    );

    const duplicated = validState();
    duplicated.jobsResponse.jobs[0]!.steps.push({
      name: LISTENER_STEP,
      status: "in_progress",
      conclusion: null,
    });
    expect(() => validatePreviewObserverState(duplicated)).toThrow(
      "Preview observer state is invalid.",
    );
  });

  it.each([
    ["queued job", { status: "queued", conclusion: null }],
    ["completed job", { status: "completed", conclusion: "success" }],
    ["cancelled job", { status: "completed", conclusion: "cancelled" }],
  ])("rejects a %s even if its listener-shaped step is present", (_label, job) => {
    const input = validState();
    Object.assign(input.jobsResponse.jobs[0]!, job);
    expect(() => validatePreviewObserverState(input)).toThrow(
      "Preview observer state is invalid.",
    );
  });

  it("rejects a mismatched commit, workflow, or evidence family", () => {
    const wrongSha = validState();
    wrongSha.runResponse.head_sha = "b".repeat(40);
    expect(() => validatePreviewObserverState(wrongSha)).toThrow(
      "Preview observer state is invalid.",
    );

    const wrongWorkflow = validState();
    wrongWorkflow.runResponse.path = ".github/workflows/preview.yml.backup";
    expect(() => validatePreviewObserverState(wrongWorkflow)).toThrow(
      "Preview observer state is invalid.",
    );

    const wrongFamily = validState();
    wrongFamily.jobsResponse.jobs[0]!.name =
      "Capture foundation_probe safe scheduled outcome";
    expect(() => validatePreviewObserverState(wrongFamily)).toThrow(
      "Preview observer state is invalid.",
    );
  });
});
