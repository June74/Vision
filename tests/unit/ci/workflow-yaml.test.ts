import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";

const UPLOAD_ARTIFACT_ACTION =
  "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02";

interface ParsedWorkflowStep {
  readonly name?: unknown;
  readonly run?: unknown;
  readonly uses?: unknown;
  readonly with?: unknown;
}

interface ParsedWorkflowJob {
  readonly steps?: unknown;
  readonly needs?: unknown;
}

interface ParsedWorkflow {
  readonly jobs?: unknown;
}

async function parseWorkflows(): Promise<
  ReadonlyMap<string, ParsedWorkflow>
> {
  const workflowDirectory = resolve(process.cwd(), ".github", "workflows");
  const names = (await readdir(workflowDirectory))
    .filter((name) => /\.ya?ml$/u.test(name))
    .sort();
  const parsed = new Map<string, ParsedWorkflow>();

  for (const name of names) {
    const source = await readFile(resolve(workflowDirectory, name), "utf8");
    const document = parseDocument(source, {
      prettyErrors: false,
      uniqueKeys: true,
    });
    expect(document.errors, `${name} must be valid YAML`).toEqual([]);
    parsed.set(name, document.toJS({ maxAliasCount: 0 }) as ParsedWorkflow);
  }
  return parsed;
}

function readJob(
  workflow: ParsedWorkflow | undefined,
  jobName: string,
): ParsedWorkflowJob {
  expect(workflow).toBeDefined();
  expect(workflow?.jobs).not.toBeNull();
  expect(typeof workflow?.jobs).toBe("object");
  expect(Array.isArray(workflow?.jobs)).toBe(false);
  const jobs = workflow?.jobs as Record<string, unknown>;
  expect(jobs[jobName]).not.toBeNull();
  expect(typeof jobs[jobName]).toBe("object");
  return jobs[jobName] as ParsedWorkflowJob;
}

function readSteps(job: ParsedWorkflowJob): readonly ParsedWorkflowStep[] {
  expect(Array.isArray(job.steps)).toBe(true);
  return job.steps as readonly ParsedWorkflowStep[];
}

function readAllWorkflowSteps(
  workflow: ParsedWorkflow | undefined,
): readonly ParsedWorkflowStep[] {
  expect(workflow).toBeDefined();
  const jobs = workflow?.jobs as Record<string, ParsedWorkflowJob>;
  return Object.values(jobs).flatMap((job) => readSteps(job));
}

function isFixedDispatchCorrelationUpload(
  step: ParsedWorkflowStep | undefined,
): boolean {
  const withOptions = step?.with as Record<string, unknown> | undefined;
  return (
    step?.uses === UPLOAD_ARTIFACT_ACTION &&
    withOptions?.name === "vision-preview-dispatch-correlation" &&
    withOptions.path === "preview-dispatch-correlation.json" &&
    withOptions["retention-days"] === 30 &&
    withOptions["if-no-files-found"] === "error"
  );
}

function hasExactlyOneFixedDispatchCorrelationUpload(
  workflow: ParsedWorkflow | undefined,
): boolean {
  const claimants = readAllWorkflowSteps(workflow).filter((step) => {
    const withOptions = step.with as Record<string, unknown> | undefined;
    return (
      withOptions?.name === "vision-preview-dispatch-correlation" ||
      withOptions?.path === "preview-dispatch-correlation.json"
    );
  });
  return (
    claimants.length === 1 &&
    isFixedDispatchCorrelationUpload(claimants[0])
  );
}

function parseWorkflowSource(source: string): ParsedWorkflow {
  const document = parseDocument(source, {
    prettyErrors: false,
    uniqueKeys: true,
  });
  expect(document.errors).toEqual([]);
  return document.toJS({ maxAliasCount: 0 }) as ParsedWorkflow;
}

describe("workflow YAML contract", () => {
  it("parses one pinned dispatch-correlation upload before all mutation-capable jobs", async () => {
    const workflows = await parseWorkflows();
    const workflow = workflows.get("preview.yml");
    const selection = readJob(workflow, "selection");
    const selectionSteps = readSteps(selection);
    const upload = selectionSteps.find(
      ({ uses }) => uses === UPLOAD_ARTIFACT_ACTION,
    );
    const jobs = workflow?.jobs as Record<string, ParsedWorkflowJob>;
    const mutationJobs = [
      "verify",
      "deploy",
      "tail",
      "ai_signal",
      "suppression_signal",
      "restore_signal",
      "role_signal",
      "ai_uniqueness",
      "suppression_uniqueness",
      "restore_uniqueness",
      "maintenance_uniqueness",
      "deploy_acceptance_candidate",
      "rollback",
      "close_rollback",
      "verify_cleanup",
      "configure_gateway",
    ];

    expect(hasExactlyOneFixedDispatchCorrelationUpload(workflow)).toBe(true);
    expect(upload?.name).toBe("Upload dispatch correlation evidence");
    expect(selectionSteps.indexOf(upload!)).toBe(
      selectionSteps.findIndex(
        ({ name }) => name === "Verify exact acceptance operation",
      ) + 1,
    );
    expect(upload?.uses).toBe(UPLOAD_ARTIFACT_ACTION);
    expect(upload?.with).toEqual({
      name: "vision-preview-dispatch-correlation",
      path: "preview-dispatch-correlation.json",
      "retention-days": 30,
      "if-no-files-found": "error",
    });
    for (const name of mutationJobs) {
      const needs = jobs[name]?.needs;
      expect(Array.isArray(needs) ? needs : [needs]).toContain("selection");
    }
    const source = await readFile(
      resolve(process.cwd(), ".github", "workflows", "preview.yml"),
      "utf8",
    );
    const renamedArtifact = source.replace(
      "name: vision-preview-dispatch-correlation",
      "name: vision-preview-dispatch-correlation-renamed",
    );
    const wrongRetention = source.replace("retention-days: 30", "retention-days: 7");
    const missingFilePolicy = source.replace(
      /^ {10}if-no-files-found: error\r?\n/mu,
      "",
    );
    const warningFilePolicy = source.replace(
      "if-no-files-found: error",
      "if-no-files-found: warn",
    );
    const wrongPath = source.replace(
      "path: preview-dispatch-correlation.json",
      "path: other.json",
    );
    const unpinnedAction = source.replace(
      UPLOAD_ARTIFACT_ACTION,
      "actions/upload-artifact@v4",
    );
    const alternateLabelDuplicate = `${source}\n  alternate_correlation_upload:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Alternate evidence label\n        uses: ${UPLOAD_ARTIFACT_ACTION}\n        with:\n          name: vision-preview-dispatch-correlation\n          path: preview-dispatch-correlation.json\n          retention-days: 30\n          if-no-files-found: error\n`;

    expect(
      hasExactlyOneFixedDispatchCorrelationUpload(
        parseWorkflowSource(renamedArtifact),
      ),
    ).toBe(false);
    expect(
      hasExactlyOneFixedDispatchCorrelationUpload(
        parseWorkflowSource(wrongRetention),
      ),
    ).toBe(false);
    expect(
      hasExactlyOneFixedDispatchCorrelationUpload(
        parseWorkflowSource(missingFilePolicy),
      ),
    ).toBe(false);
    expect(
      hasExactlyOneFixedDispatchCorrelationUpload(
        parseWorkflowSource(warningFilePolicy),
      ),
    ).toBe(false);
    expect(
      hasExactlyOneFixedDispatchCorrelationUpload(parseWorkflowSource(wrongPath)),
    ).toBe(false);
    expect(
      hasExactlyOneFixedDispatchCorrelationUpload(
        parseWorkflowSource(unpinnedAction),
      ),
    ).toBe(false);
    expect(
      hasExactlyOneFixedDispatchCorrelationUpload(
        parseWorkflowSource(alternateLabelDuplicate),
      ),
    ).toBe(false);
  });

  it("parses every committed workflow with a genuine YAML parser", async () => {
    const workflows = await parseWorkflows();

    expect([...workflows.keys()]).toEqual([
      "ci.yml",
      "preview.yml",
      "production.yml",
    ]);
    for (const workflow of workflows.values()) {
      expect(workflow.jobs).not.toBeNull();
      expect(typeof workflow.jobs).toBe("object");
      expect(Array.isArray(workflow.jobs)).toBe(false);
    }
  });

  it("keeps the production build, validation, dry-run, and deploy path reachable in parsed step order", async () => {
    const workflows = await parseWorkflows();
    const steps = readSteps(readJob(workflows.get("production.yml"), "deploy"));
    const names = steps.map(({ name }) => name);

    expect(names).toEqual(
      expect.arrayContaining([
        "Build explicit production artifact",
        "Validate explicit production artifact",
        "Dry-run explicit production artifact",
        "Deploy release Worker",
      ]),
    );
    expect(names.indexOf("Build explicit production artifact")).toBeLessThan(
      names.indexOf("Validate explicit production artifact"),
    );
    expect(names.indexOf("Validate explicit production artifact")).toBeLessThan(
      names.indexOf("Dry-run explicit production artifact"),
    );
    expect(names.indexOf("Dry-run explicit production artifact")).toBeLessThan(
      names.indexOf("Deploy release Worker"),
    );

    const dryRun = steps.find(
      ({ name }) => name === "Dry-run explicit production artifact",
    );
    const deploy = steps.find(({ name }) => name === "Deploy release Worker");
    expect(dryRun?.run).toContain("wrangler deploy --dry-run");
    expect(dryRun?.run).toContain("--config dist/vision/wrangler.json");
    expect(deploy?.run).toContain(
      "wrangler deploy --config dist/vision/wrangler.json",
    );
  });

  it("keeps preview predeploy checks before the durable mutation boundary and deploy", async () => {
    const workflows = await parseWorkflows();
    const steps = readSteps(
      readJob(workflows.get("preview.yml"), "deploy_acceptance_candidate"),
    );
    const names = steps.map(({ name }) => name);
    const writeIndex = names.indexOf("Write candidate mutation boundary");
    const uploadIndex = names.indexOf("Upload candidate mutation boundary");
    const deployIndex = names.indexOf("Deploy generated acceptance candidate");

    for (const stage of [
      "Reverify active matching observer immediately before deploy",
      "Recheck daily recovery overlap immediately before deploy",
      "Re-admit same-commit role-probe closure immediately before restore",
    ]) {
      expect(names.indexOf(stage), stage).toBeLessThan(writeIndex);
    }
    expect(writeIndex).toBeGreaterThan(-1);
    expect(uploadIndex).toBe(writeIndex + 1);
    expect(deployIndex).toBe(uploadIndex + 1);
  });
});
