import { describe, expect, it, vi } from "vitest";
import {
  runPrivacySafeGitRemote,
  runPrivacySafeGitRemoteCli,
  type PrivacySafeGitRemoteCommandResult,
  type PrivacySafeGitRemoteDependencies,
} from "../../../scripts/privacy-safe-git-remote";

const BRANCH = "codex/phase-b-foundation" as const;
const PARENT = "a".repeat(40);
const COMMIT = "b".repeat(40);
const REF = "refs/heads/codex/phase-b-foundation";
const FAILURE = "Privacy-safe Git operation failed.";

function result(
  stdout: string,
  overrides: Partial<PrivacySafeGitRemoteCommandResult> = {},
): PrivacySafeGitRemoteCommandResult {
  return { exitCode: 0, stdout, stderr: "", ...overrides };
}

function tip(commit: string): string {
  return `${commit}\t${REF}\n`;
}

function dependencies(
  responses: readonly PrivacySafeGitRemoteCommandResult[],
): PrivacySafeGitRemoteDependencies & {
  readonly calls: Array<{
    readonly executable: string;
    readonly arguments_: readonly string[];
  }>;
} {
  const queue = [...responses];
  const calls: Array<{
    readonly executable: string;
    readonly arguments_: readonly string[];
  }> = [];
  return {
    calls,
    runCommand: vi.fn(async (executable, arguments_) => {
      calls.push({ executable, arguments_: [...arguments_] });
      const next = queue.shift();
      if (next === undefined) throw new Error("untrusted child failure");
      return next;
    }),
  };
}

describe("privacy-safe Git remote adapter", () => {
  it("asserts the exact fixed origin branch tip through an argument array", async () => {
    const deps = dependencies([result(tip(COMMIT))]);

    await expect(
      runPrivacySafeGitRemote(
        {
          operation: "assert_tip",
          reviewedBranch: BRANCH,
          expectedCommit: COMMIT,
        },
        deps,
      ),
    ).resolves.toEqual({ succeeded: true, exactTipMatch: true });

    expect(deps.calls).toEqual([
      {
        executable: "git",
        arguments_: ["ls-remote", "--heads", "origin", REF],
      },
    ]);
  });

  it("pushes only the reviewed commit with an exact-parent lease", async () => {
    const deps = dependencies([
      result(tip(PARENT), { stderr: "discarded pre-query warning" }),
      result("discarded push output", { stderr: "discarded push warning" }),
      result(tip(COMMIT), { stderr: "discarded post-query warning" }),
    ]);

    await expect(
      runPrivacySafeGitRemote(
        {
          operation: "push_exact",
          reviewedBranch: BRANCH,
          expectedParent: PARENT,
          expectedCommit: COMMIT,
        },
        deps,
      ),
    ).resolves.toEqual({ succeeded: true, exactTipMatch: true });

    expect(deps.calls.map((call) => call.arguments_)).toEqual([
      ["ls-remote", "--heads", "origin", REF],
      [
        "push",
        "--porcelain",
        `--force-with-lease=${REF}:${PARENT}`,
        "origin",
        `${COMMIT}:${REF}`,
      ],
      ["ls-remote", "--heads", "origin", REF],
    ]);
    expect(deps.calls[1]?.arguments_).not.toContain(`HEAD:${REF}`);
  });

  it.each([
    ["missing", ""],
    ["uppercase", tip(COMMIT.toUpperCase())],
    ["malformed", "not-a-tip\n"],
    ["multiline", `${tip(COMMIT)}${tip(COMMIT)}`],
    ["wrong ref", `${COMMIT}\trefs/heads/not-allowed\n`],
    ["URL-bearing", `https://example.invalid/${COMMIT}\n`],
    ["credential-shaped", `token_secret=${COMMIT}\n`],
  ])("rejects %s tip output with one constant error", async (_name, stdout) => {
    const deps = dependencies([result(stdout)]);

    await expect(
      runPrivacySafeGitRemote(
        {
          operation: "assert_tip",
          reviewedBranch: BRANCH,
          expectedCommit: COMMIT,
        },
        deps,
      ),
    ).rejects.toThrow(FAILURE);
  });

  it("fails before push when the remote parent moved", async () => {
    const deps = dependencies([result(tip(COMMIT))]);

    await expect(
      runPrivacySafeGitRemote(
        {
          operation: "push_exact",
          reviewedBranch: BRANCH,
          expectedParent: PARENT,
          expectedCommit: COMMIT,
        },
        deps,
      ),
    ).rejects.toThrow(FAILURE);
    expect(deps.calls).toHaveLength(1);
  });

  it("fails closed on push failure and post-push movement", async () => {
    const failedPush = dependencies([
      result(tip(PARENT)),
      result("provider detail", { exitCode: 1, stderr: "private failure" }),
    ]);
    await expect(
      runPrivacySafeGitRemote(
        {
          operation: "push_exact",
          reviewedBranch: BRANCH,
          expectedParent: PARENT,
          expectedCommit: COMMIT,
        },
        failedPush,
      ),
    ).rejects.toThrow(FAILURE);

    const moved = dependencies([
      result(tip(PARENT)),
      result("private push success"),
      result(tip(PARENT)),
    ]);
    await expect(
      runPrivacySafeGitRemote(
        {
          operation: "push_exact",
          reviewedBranch: BRANCH,
          expectedParent: PARENT,
          expectedCommit: COMMIT,
        },
        moved,
      ),
    ).rejects.toThrow(FAILURE);
  });

  it("rejects noncanonical inputs, extra keys, nonzero queries, and child errors", async () => {
    const cases: Array<{
      readonly input: Parameters<typeof runPrivacySafeGitRemote>[0];
      readonly deps: PrivacySafeGitRemoteDependencies;
    }> = [
      {
        input: {
          operation: "assert_tip",
          reviewedBranch: BRANCH,
          expectedCommit: COMMIT.toUpperCase(),
        },
        deps: dependencies([]),
      },
      {
        input: {
          operation: "assert_tip",
          reviewedBranch: BRANCH,
          expectedCommit: COMMIT,
          remoteUrl: "private remote",
        } as Parameters<typeof runPrivacySafeGitRemote>[0],
        deps: dependencies([]),
      },
      {
        input: {
          operation: "assert_tip",
          reviewedBranch: BRANCH,
          expectedCommit: COMMIT,
        },
        deps: dependencies([result(tip(COMMIT), { exitCode: 1 })]),
      },
      {
        input: {
          operation: "assert_tip",
          reviewedBranch: BRANCH,
          expectedCommit: COMMIT,
        },
        deps: {
          runCommand: vi.fn(async () => {
            throw new Error("private child arguments and output");
          }),
        },
      },
    ];

    for (const candidate of cases) {
      await expect(
        runPrivacySafeGitRemote(candidate.input, candidate.deps),
      ).rejects.toThrow(FAILURE);
    }
  });

  it("keeps all untrusted fragments out of returned and thrown values", async () => {
    const fragments = [
      "https://example.invalid/private",
      "credential_secret_value",
      "refs/heads/untrusted",
      "child argument detail",
    ];
    for (const fragment of fragments) {
      const deps: PrivacySafeGitRemoteDependencies = {
        runCommand: vi.fn(async () => {
          throw new Error(fragment);
        }),
      };
      let observed = "";
      try {
        await runPrivacySafeGitRemote(
          {
            operation: "assert_tip",
            reviewedBranch: BRANCH,
            expectedCommit: COMMIT,
          },
          deps,
        );
      } catch (error) {
        observed = error instanceof Error ? error.message : String(error);
      }
      expect(observed).toBe(FAILURE);
      expect(observed).not.toContain(fragment);
    }
  });

  it("emits only True or the constant safe failure from the CLI seam", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const success = await runPrivacySafeGitRemoteCli(
      ["assert_tip", "--branch", BRANCH, "--expected-commit", COMMIT],
      dependencies([result(tip(COMMIT))]),
      {
        writeStdout: (value) => stdout.push(value),
        writeStderr: (value) => stderr.push(value),
      },
    );
    expect(success).toBe(0);
    expect(stdout).toEqual(["True\n"]);
    expect(stderr).toEqual([]);

    stdout.length = 0;
    const failure = await runPrivacySafeGitRemoteCli(
      ["assert_tip", "--branch", BRANCH, "--expected-commit", PARENT],
      dependencies([result(tip(COMMIT), { stderr: "private child output" })]),
      {
        writeStdout: (value) => stdout.push(value),
        writeStderr: (value) => stderr.push(value),
      },
    );
    expect(failure).toBe(1);
    expect(stdout).toEqual([]);
    expect(stderr).toEqual([`${FAILURE}\n`]);
  });
});
