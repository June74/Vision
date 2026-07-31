/** Privately re-admits one same-commit role closure before restore. */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  assertPreviewRollbackClosure,
  validateCompletedPreviewLifecycleRun,
} from "./validate-preview-rollback-lifecycle";

const FAILURE = "Preview restore re-admission failed closed.";
const MAX_CAPTURE_BYTES = 1_048_576;
const RUN_REF_PATTERN = /^[1-9][0-9]{0,19}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const execFileAsync = promisify(execFile);

export type PreviewRestoreReadmissionCommandRunner = (
  executable: string,
  arguments_: readonly string[],
) => Promise<{
  readonly stdout: string;
  readonly stderr: string;
}>;

export interface PreviewRestoreReadmissionDependencies {
  /** Runs one fully captured argument-array metadata command. */
  runCommand(
    executable: string,
    arguments_: readonly string[],
  ): ReturnType<PreviewRestoreReadmissionCommandRunner>;
  /** Creates one private workspace for the downloaded closure proof. */
  makeTemporaryDirectory(): Promise<string>;
  /** Reads one downloaded proof without rendering its contents. */
  readFile(path: string): Promise<string>;
  /** Removes the private proof workspace before the boundary settles. */
  removeTemporaryDirectory(path: string): Promise<void>;
}

/** Captures all child streams and returns only one fixed admission status. */
export async function readmitPreviewRestore(
  input: {
    readonly repository: string;
    readonly candidateRunRef: string;
    readonly closureRunRef: string;
    readonly reviewedCommit: string;
  },
  dependencies: PreviewRestoreReadmissionDependencies =
    createPreviewRestoreReadmissionDependencies(),
): Promise<{ readonly admission: "verified" }> {
  let temporaryDirectory: string | null = null;
  let admitted = false;
  try {
    validateInput(input);
    temporaryDirectory = await dependencies.makeTemporaryDirectory();
    if (
      typeof temporaryDirectory !== "string" ||
      temporaryDirectory.length === 0
    ) {
      fail();
    }
    const runResult = await dependencies.runCommand("gh", [
      "api",
      "-X",
      "GET",
      `repos/${input.repository}/actions/runs/${input.closureRunRef}`,
      "--jq",
      "{event,status,conclusion,head_sha,path,run_started_at,updated_at}",
    ]);
    const jobsResult = await dependencies.runCommand("gh", [
      "api",
      "-X",
      "GET",
      `repos/${input.repository}/actions/runs/${input.closureRunRef}/jobs`,
      "-f",
      "per_page=100",
      "--jq",
      "{jobs: [.jobs[] | {name,status,conclusion}]}",
    ]);
    const run = await parseCapturedJson(runResult);
    const jobs = await parseCapturedJson(jobsResult);
    validateCompletedPreviewLifecycleRun({
      run,
      jobs,
      expectedCommit: input.reviewedCommit,
      expectedJobName: "Close restored normal preview",
    });

    await validateCapturedResult(
      dependencies.runCommand("gh", [
        "run",
        "download",
        input.closureRunRef,
        "--repo",
        input.repository,
        "--name",
        "vision-preview-rollback-closed",
        "--dir",
        temporaryDirectory,
      ]),
    );
    const closureProof = JSON.parse(
      await dependencies.readFile(
        join(temporaryDirectory, "preview-rollback-closure.json"),
      ),
    ) as unknown;
    assertPreviewRollbackClosure({
      closureProof,
      latestCandidateRunRef: input.candidateRunRef,
      expectedCommit: input.reviewedCommit,
      operation: "deploy_restore",
    });
    admitted = true;
  } catch {
    admitted = false;
  } finally {
    if (temporaryDirectory !== null) {
      try {
        await dependencies.removeTemporaryDirectory(temporaryDirectory);
      } catch {
        admitted = false;
      }
    }
  }
  if (!admitted) fail();
  return Object.freeze({ admission: "verified" as const });
}

/** Creates the concrete captured argument-array process/file boundary. */
function createPreviewRestoreReadmissionDependencies():
  PreviewRestoreReadmissionDependencies {
  /** Runs one fully captured argument-array metadata command. */
  const runCommand: PreviewRestoreReadmissionCommandRunner =
    async (executable, arguments_) => {
      const result = await execFileAsync(executable, [...arguments_], {
        encoding: "utf8",
        maxBuffer: MAX_CAPTURE_BYTES,
        windowsHide: true,
      });
      return Object.freeze({
        stdout: result.stdout,
        stderr: result.stderr,
      });
    };
  return Object.freeze({
    runCommand,
    /** Creates one private workspace for the downloaded closure proof. */
    makeTemporaryDirectory: () =>
      mkdtemp(join(tmpdir(), "preview-restore-readmission-")),
    /** Reads one downloaded proof without rendering its contents. */
    readFile: (path: string) => readFile(path, "utf8"),
    /** Removes the private proof workspace before the boundary settles. */
    removeTemporaryDirectory: (path: string) =>
      rm(path, { recursive: true, force: true }),
  });
}

/** Requires one exact public input before any child is invoked. */
function validateInput(input: {
  readonly repository: string;
  readonly candidateRunRef: string;
  readonly closureRunRef: string;
  readonly reviewedCommit: string;
}): void {
  if (
    !REPOSITORY_PATTERN.test(input.repository) ||
    !RUN_REF_PATTERN.test(input.candidateRunRef) ||
    !RUN_REF_PATTERN.test(input.closureRunRef) ||
    !COMMIT_PATTERN.test(input.reviewedCommit)
  ) {
    fail();
  }
}

/** Parses one bounded captured JSON response and ignores its private stderr. */
async function parseCapturedJson(result: {
  readonly stdout: string;
  readonly stderr: string;
}): Promise<unknown> {
  await validateCapturedResult(result);
  return JSON.parse(result.stdout) as unknown;
}

/** Bounds captured streams without rendering either stream. */
async function validateCapturedResult(
  resultOrPromise:
    | Promise<{ readonly stdout: string; readonly stderr: string }>
    | { readonly stdout: string; readonly stderr: string },
): Promise<void> {
  const result = await resultOrPromise;
  if (
    typeof result?.stdout !== "string" ||
    typeof result.stderr !== "string" ||
    Buffer.byteLength(result.stdout, "utf8") > MAX_CAPTURE_BYTES ||
    Buffer.byteLength(result.stderr, "utf8") > MAX_CAPTURE_BYTES
  ) {
    fail();
  }
}

/** Parses the one exact CLI shape. */
function parseArguments(arguments_: readonly string[]): {
  readonly repository: string;
  readonly candidateRunRef: string;
  readonly closureRunRef: string;
  readonly reviewedCommit: string;
} {
  const expected = new Set([
    "--repository",
    "--candidate-run-ref",
    "--closure-run-ref",
    "--commit",
  ]);
  const values = new Map<string, string>();
  if (arguments_.length !== 8) fail();
  for (let index = 0; index < arguments_.length; index += 2) {
    const flag = arguments_[index];
    const value = arguments_[index + 1];
    if (
      !flag ||
      !value ||
      !expected.has(flag) ||
      values.has(flag)
    ) {
      fail();
    }
    values.set(flag, value);
  }
  const input = {
    repository: values.get("--repository") ?? "",
    candidateRunRef: values.get("--candidate-run-ref") ?? "",
    closureRunRef: values.get("--closure-run-ref") ?? "",
    reviewedCommit: values.get("--commit") ?? "",
  };
  validateInput(input);
  return input;
}

/** Runs without writing child details or identifiers to either stream. */
async function main(): Promise<void> {
  try {
    await readmitPreviewRestore(parseArguments(process.argv.slice(2)));
  } catch {
    process.exitCode = 1;
  }
}

/** Throws the sole public failure. */
function fail(): never {
  throw new Error(FAILURE);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
