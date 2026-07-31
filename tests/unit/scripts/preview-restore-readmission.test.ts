import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  readmitPreviewRestore,
  type PreviewRestoreReadmissionDependencies,
} from "../../../scripts/run-preview-restore-readmission";
import {
  closePreviewRollback,
  createPreviewCandidateIntent,
  createPreviewRollbackRestoreProof,
} from "../../../scripts/validate-preview-rollback-lifecycle";

const COMMIT = "a".repeat(40);
const CANDIDATE_RUN_REF = "1201";
const CLOSURE_RUN_REF = "1202";
const CANARY = "SECRET_CHILD_STREAM_CANARY";
const MAX_CLOSURE_PROOF_BYTES = 8_192;

function closureProof() {
  const intent = createPreviewCandidateIntent({
    candidateCommit: COMMIT,
    operation: "deploy_role_probe",
  });
  const restore = createPreviewRollbackRestoreProof({
    candidateIntent: intent,
    candidateRunRef: CANDIDATE_RUN_REF,
    restoredCommit: COMMIT,
    restoredAt: "2026-07-29T07:00:00.000Z",
    providerVerifiedAt: "2026-07-29T07:01:00.000Z",
    normalProviderState: "verified",
  });
  return closePreviewRollback({
    restoreProof: restore,
    candidateRunRef: CANDIDATE_RUN_REF,
    restoredCommit: COMMIT,
    authenticatedReadsGate: "verified",
    closureProviderVerifiedAt: "2026-07-29T07:01:30.000Z",
    closedAt: "2026-07-29T07:02:00.000Z",
  });
}

function dependencies(): PreviewRestoreReadmissionDependencies {
  const responses = [
    {
      stdout: JSON.stringify({
        event: "workflow_dispatch",
        status: "completed",
        conclusion: "success",
        head_sha: COMMIT,
        path: ".github/workflows/preview.yml",
        run_started_at: "2026-07-29T07:00:00.000Z",
        updated_at: "2026-07-29T07:03:00.000Z",
      }),
      stderr: CANARY,
    },
    {
      stdout: JSON.stringify({
        jobs: [{
          name: "Close restored normal preview",
          status: "completed",
          conclusion: "success",
        }],
      }),
      stderr: CANARY,
    },
    { stdout: CANARY, stderr: CANARY },
  ];
  return {
    runCommand: vi.fn(async () => responses.shift()!),
    makeTemporaryDirectory: vi.fn(async () => "C:\\safe-temp"),
    readFile: vi.fn(
      async () => Buffer.from(JSON.stringify(closureProof()), "utf8"),
    ) as never,
    removeTemporaryDirectory: vi.fn(async () => undefined),
  };
}

describe("preview restore re-admission", () => {
  it("captures every metadata child stream and returns only a fixed status", async () => {
    const deps = dependencies();
    const result = await readmitPreviewRestore({
      repository: "owner/repository",
      candidateRunRef: CANDIDATE_RUN_REF,
      closureRunRef: CLOSURE_RUN_REF,
      reviewedCommit: COMMIT,
    }, deps);
    expect(result).toEqual({ admission: "verified" });
    expect(JSON.stringify(result)).not.toContain(CANARY);
    expect(deps.runCommand).toHaveBeenCalledTimes(3);
    for (const [executable, arguments_] of vi.mocked(deps.runCommand).mock.calls) {
      expect(executable).toBe("gh");
      expect(arguments_).toBeInstanceOf(Array);
    }
  });

  it("maps a child failure containing canaries to one fixed safe error", async () => {
    const deps = dependencies();
    vi.mocked(deps.runCommand).mockRejectedValueOnce(new Error(CANARY));
    await expect(readmitPreviewRestore({
      repository: "owner/repository",
      candidateRunRef: CANDIDATE_RUN_REF,
      closureRunRef: CLOSURE_RUN_REF,
      reviewedCommit: COMMIT,
    }, deps)).rejects.toThrow(
      "Preview restore re-admission failed closed.",
    );
    expect(deps.removeTemporaryDirectory).toHaveBeenCalledOnce();
  });

  it("rejects an oversized injected closure proof without exposing child-stream canaries", async () => {
    const deps = dependencies();
    const serialized = JSON.stringify(closureProof());
    deps.readFile = vi.fn(async () =>
      Buffer.from(
        `${serialized}${" ".repeat(MAX_CLOSURE_PROOF_BYTES)}`,
        "utf8",
      )) as never;

    const error = await readmitPreviewRestore({
      repository: "owner/repository",
      candidateRunRef: CANDIDATE_RUN_REF,
      closureRunRef: CLOSURE_RUN_REF,
      reviewedCommit: COMMIT,
    }, deps).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "Preview restore re-admission failed closed.",
    );
    expect((error as Error).message).not.toContain(CANARY);
    expect(deps.removeTemporaryDirectory).toHaveBeenCalledOnce();
  });

  it("bounds the production closure-proof reader to max plus one bytes", async () => {
    const module = await import(
      "../../../scripts/run-preview-restore-readmission"
    );
    const createDependencies = (
      module as unknown as {
        createPreviewRestoreReadmissionDependencies?: () =>
          PreviewRestoreReadmissionDependencies;
      }
    ).createPreviewRestoreReadmissionDependencies;
    expect(createDependencies).toBeTypeOf("function");
    if (typeof createDependencies !== "function") {
      throw new Error("bounded production reader is unavailable");
    }
    const production = createDependencies();
    const directory = await production.makeTemporaryDirectory();
    const path = join(directory, "preview-rollback-closure.json");
    try {
      await writeFile(
        path,
        Buffer.alloc(MAX_CLOSURE_PROOF_BYTES + 100, 0x61),
      );
      const proof = await production.readFile(path) as unknown;
      expect(proof).toBeInstanceOf(Uint8Array);
      expect((proof as Uint8Array).byteLength).toBe(
        MAX_CLOSURE_PROOF_BYTES + 1,
      );
    } finally {
      await production.removeTemporaryDirectory(directory);
    }
  });
});
