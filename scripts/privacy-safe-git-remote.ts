/** Owns privacy-safe remote-tip assertions and exact pushes for one branch. */
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FAILURE = "Privacy-safe Git operation failed.";
const REVIEWED_BRANCH = "codex/phase-b-foundation";
const REVIEWED_REF = `refs/heads/${REVIEWED_BRANCH}`;
const MAX_CHILD_OUTPUT_BYTES = 65_536;

export interface PrivacySafeGitRemoteResult {
  readonly succeeded: true;
  readonly exactTipMatch: true;
}

export interface PrivacySafeGitRemoteCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface PrivacySafeGitRemoteDependencies {
  runCommand(
    executable: string,
    arguments_: readonly string[],
  ): Promise<PrivacySafeGitRemoteCommandResult>;
}

export interface PrivacySafeGitRemoteCliOutput {
  writeStdout(value: string): void;
  writeStderr(value: string): void;
}

export type PrivacySafeGitRemoteInput =
  | {
      readonly operation: "assert_tip";
      readonly reviewedBranch: "codex/phase-b-foundation";
      readonly expectedCommit: string;
    }
  | {
      readonly operation: "push_exact";
      readonly reviewedBranch: "codex/phase-b-foundation";
      readonly expectedParent: string;
      readonly expectedCommit: string;
    };

/** Runs one fixed-origin remote operation and exposes no child material. */
export async function runPrivacySafeGitRemote(
  input: PrivacySafeGitRemoteInput,
  dependencies: PrivacySafeGitRemoteDependencies,
): Promise<PrivacySafeGitRemoteResult> {
  try {
    const operation = readOperation(input);
    if (operation.operation === "assert_tip") {
      const tip = await readRemoteTip(dependencies);
      if (tip !== operation.expectedCommit) fail();
    } else {
      const parent = await readRemoteTip(dependencies);
      if (parent !== operation.expectedParent) fail();
      await runCaptured(dependencies, [
        "push",
        "--porcelain",
        "origin",
        `HEAD:${REVIEWED_REF}`,
      ]);
      const tip = await readRemoteTip(dependencies);
      if (tip !== operation.expectedCommit) fail();
    }
    return Object.freeze({ succeeded: true, exactTipMatch: true });
  } catch {
    fail();
  }
}

/** Parses the frozen CLI and emits only True or the constant safe failure. */
export async function runPrivacySafeGitRemoteCli(
  arguments_: readonly string[],
  dependencies: PrivacySafeGitRemoteDependencies,
  output: PrivacySafeGitRemoteCliOutput,
): Promise<0 | 1> {
  try {
    const input = parseCliArguments(arguments_);
    await runPrivacySafeGitRemote(input, dependencies);
    output.writeStdout("True\n");
    return 0;
  } catch {
    output.writeStderr(`${FAILURE}\n`);
    return 1;
  }
}

/** Creates the permanent captured argument-array child-process boundary. */
export function createPrivacySafeGitRemoteSubprocessDependencies():
PrivacySafeGitRemoteDependencies {
  return Object.freeze({ runCommand: runCapturedGitCommand });
}

/** Resolves one exact canonical tip for the fixed origin ref. */
async function readRemoteTip(
  dependencies: PrivacySafeGitRemoteDependencies,
): Promise<string> {
  const result = await runCaptured(dependencies, [
    "ls-remote",
    "--heads",
    "origin",
    REVIEWED_REF,
  ]);
  const match = new RegExp(
    `^([a-f0-9]{40})\\t${escapeRegExp(REVIEWED_REF)}(?:\\r?\\n)?$`,
    "u",
  ).exec(result.stdout);
  if (match === null || match[1] === undefined) fail();
  return match[1];
}

/** Captures, validates, and then discards both child streams. */
async function runCaptured(
  dependencies: PrivacySafeGitRemoteDependencies,
  arguments_: readonly string[],
): Promise<PrivacySafeGitRemoteCommandResult> {
  let result: PrivacySafeGitRemoteCommandResult;
  try {
    result = await dependencies.runCommand("git", Object.freeze([...arguments_]));
  } catch {
    fail();
  }
  const record = exactRecord(result, ["exitCode", "stdout", "stderr"]);
  const exitCode = ownData(record, "exitCode");
  const stdout = ownData(record, "stdout");
  const stderr = ownData(record, "stderr");
  if (
    exitCode !== 0 ||
    typeof stdout !== "string" ||
    typeof stderr !== "string" ||
    Buffer.byteLength(stdout, "utf8") > MAX_CHILD_OUTPUT_BYTES ||
    Buffer.byteLength(stderr, "utf8") > MAX_CHILD_OUTPUT_BYTES
  ) {
    fail();
  }
  return Object.freeze({ exitCode: 0, stdout, stderr });
}

/** Snapshots only one exact runtime input variant. */
function readOperation(input: PrivacySafeGitRemoteInput): PrivacySafeGitRemoteInput {
  const initial = exactRecord(input, undefined);
  const operation = ownData(initial, "operation");
  if (operation === "assert_tip") {
    const record = exactRecord(input, [
      "operation",
      "reviewedBranch",
      "expectedCommit",
    ]);
    const branch = ownData(record, "reviewedBranch");
    const expectedCommit = ownData(record, "expectedCommit");
    if (branch !== REVIEWED_BRANCH || !canonicalCommit(expectedCommit)) fail();
    return Object.freeze({
      operation,
      reviewedBranch: REVIEWED_BRANCH,
      expectedCommit,
    });
  }
  if (operation === "push_exact") {
    const record = exactRecord(input, [
      "operation",
      "reviewedBranch",
      "expectedParent",
      "expectedCommit",
    ]);
    const branch = ownData(record, "reviewedBranch");
    const expectedParent = ownData(record, "expectedParent");
    const expectedCommit = ownData(record, "expectedCommit");
    if (
      branch !== REVIEWED_BRANCH ||
      !canonicalCommit(expectedParent) ||
      !canonicalCommit(expectedCommit)
    ) {
      fail();
    }
    return Object.freeze({
      operation,
      reviewedBranch: REVIEWED_BRANCH,
      expectedParent,
      expectedCommit,
    });
  }
  fail();
}

/** Parses only the two frozen positional CLI shapes used by cleanup. */
function parseCliArguments(arguments_: readonly string[]): PrivacySafeGitRemoteInput {
  if (
    arguments_.length === 5 &&
    arguments_[0] === "assert_tip" &&
    arguments_[1] === "--branch" &&
    arguments_[2] === REVIEWED_BRANCH &&
    arguments_[3] === "--expected-commit"
  ) {
    return {
      operation: "assert_tip",
      reviewedBranch: REVIEWED_BRANCH,
      expectedCommit: arguments_[4]!,
    };
  }
  if (
    arguments_.length === 7 &&
    arguments_[0] === "push_exact" &&
    arguments_[1] === "--branch" &&
    arguments_[2] === REVIEWED_BRANCH &&
    arguments_[3] === "--expected-parent" &&
    arguments_[5] === "--expected-commit"
  ) {
    return {
      operation: "push_exact",
      reviewedBranch: REVIEWED_BRANCH,
      expectedParent: arguments_[4]!,
      expectedCommit: arguments_[6]!,
    };
  }
  fail();
}

/** Runs git without inheriting either child stream. */
async function runCapturedGitCommand(
  executable: string,
  arguments_: readonly string[],
): Promise<PrivacySafeGitRemoteCommandResult> {
  return new Promise((resolvePromise) => {
    try {
      execFile(
        executable,
        [...arguments_],
        {
          encoding: "utf8",
          maxBuffer: MAX_CHILD_OUTPUT_BYTES,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          resolvePromise({
            exitCode: error === null ? 0 : 1,
            stdout: typeof stdout === "string" ? stdout : "",
            stderr: typeof stderr === "string" ? stderr : "",
          });
        },
      );
    } catch {
      resolvePromise({ exitCode: 1, stdout: "", stderr: "" });
    }
  });
}

/** Requires a plain exact-key record with own enumerable data properties. */
function exactRecord(
  value: unknown,
  keys: readonly string[] | undefined,
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail();
  const record = value as Record<string, unknown>;
  const actualKeys = Object.keys(record).sort();
  if (
    keys !== undefined &&
    (actualKeys.length !== keys.length ||
      actualKeys.some((key, index) => key !== [...keys].sort()[index]))
  ) {
    fail();
  }
  for (const key of actualKeys) ownData(record, key);
  return record;
}

/** Reads an own enumerable data property without invoking an accessor. */
function ownData(record: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (
    descriptor === undefined ||
    !descriptor.enumerable ||
    !("value" in descriptor)
  ) {
    fail();
  }
  return descriptor.value;
}

/** Recognizes one canonical lowercase reviewed commit. */
function canonicalCommit(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
}

/** Escapes the fixed ref before exact regular-expression matching. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** Throws the sole value-free adapter failure. */
function fail(): never {
  throw new Error(FAILURE);
}

/** Runs the permanent CLI with captured subprocess dependencies. */
async function main(): Promise<void> {
  const exitCode = await runPrivacySafeGitRemoteCli(
    process.argv.slice(2),
    createPrivacySafeGitRemoteSubprocessDependencies(),
    {
      /** Writes only the admitted success token. */
      writeStdout: (value) => process.stdout.write(value),
      /** Writes only the constant safe failure. */
      writeStderr: (value) => process.stderr.write(value),
    },
  );
  process.exitCode = exitCode;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main();
}
