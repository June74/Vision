import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";

interface ParsedWorkflowStep {
  readonly name?: unknown;
  readonly run?: unknown;
}

interface ParsedWorkflowJob {
  readonly steps?: unknown;
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

describe("workflow YAML contract", () => {
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
