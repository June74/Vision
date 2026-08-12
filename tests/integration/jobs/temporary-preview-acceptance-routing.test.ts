import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CALENDAR_MAINTENANCE_CRON,
  scheduled,
} from "../../../src/jobs/scheduled";

const NOW = new Date("2026-07-30T18:00:00.000Z");

function dependencies() {
  return {
    currentTime: () => NOW,
    maintenance: vi.fn(),
    recovery: vi.fn(),
    temporaryRoleProbe: vi.fn(),
    temporaryRestore: vi.fn(),
    foundationProbe: vi.fn(),
    aiUsageEvidence: vi.fn(),
    temporaryFaultR2Upload: vi.fn(),
    writeTemporaryFaultEvidence: vi.fn(),
  };
}

describe("current-workflow preview role and restore routing", () => {
  it.each([
    ["role_probe", "temporaryRoleProbe"],
    ["restore", "temporaryRestore"],
  ] as const)("routes only the exact %s selector on the temporary cron", async (selector, method) => {
    const deps = dependencies();
    await scheduled(
      { cron: "* * * * *", scheduledTime: NOW.getTime() } as ScheduledController,
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: selector,
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-30T18:10:00.000Z",
      } as never,
      {} as ExecutionContext,
      deps,
    );
    expect(deps[method]).toHaveBeenCalledOnce();
    expect(deps.temporaryRoleProbe).toHaveBeenCalledTimes(
      method === "temporaryRoleProbe" ? 1 : 0,
    );
    expect(deps.temporaryRestore).toHaveBeenCalledTimes(
      method === "temporaryRestore" ? 1 : 0,
    );
  });

  it("does not infer role probe from restore secret presence", async () => {
    const deps = dependencies();
    await expect(
      scheduled(
        { cron: "* * * * *", scheduledTime: NOW.getTime() } as ScheduledController,
        {
          VISION_ENV: "preview",
          PREVIEW_RESTORE_DATABASE_URL: "not-inspected",
        } as never,
        {} as ExecutionContext,
        deps,
      ),
    ).rejects.toThrow("Temporary preview candidate is invalid.");
    expect(deps.temporaryRoleProbe).not.toHaveBeenCalled();
  });

  it("keeps the production restore adapter on the read-only catalog and one-shot fence", async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        "src",
        "jobs",
        "temporary-preview-restore-production.ts",
      ),
      "utf8",
    );
    expect(source).toContain("BackupObjectCatalogReader");
    expect(source).toContain('Pick<RestoreAttemptStore, "claimOnce">');
    expect(source).not.toContain("createR2BackupObjectStore");
    expect(source).not.toContain("putIfAbsent");
    expect(source).not.toMatch(/\.delete\s*\(/u);
    expect(source).not.toContain("R2Bucket");
    expect(source).not.toContain("Env");
  });

  it("constructs the production dependency factory once and invokes restore once after admission", async () => {
    const produced = dependencies();
    const factory = vi.fn(() => produced as never);
    await scheduled(
      { cron: "* * * * *", scheduledTime: NOW.getTime() } as ScheduledController,
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "restore",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-30T18:10:00.000Z",
      } as never,
      {} as ExecutionContext,
      undefined,
      factory,
    );

    expect(factory).toHaveBeenCalledTimes(1);
    expect(produced.temporaryRestore).toHaveBeenCalledTimes(1);
    expect(produced.temporaryRoleProbe).not.toHaveBeenCalled();
    expect(produced.foundationProbe).not.toHaveBeenCalled();
  });
});

describe("calendar maintenance scheduled timestamp routing", () => {
  it("normalizes seconds-level delivery offset to the containing UTC minute", async () => {
    const deps = dependencies();
    await scheduled(
      {
        cron: CALENDAR_MAINTENANCE_CRON,
        scheduledTime: Date.parse("2026-08-12T19:45:56.000Z"),
      } as ScheduledController,
      { VISION_ENV: "preview" } as never,
      {} as ExecutionContext,
      deps,
    );

    expect(deps.maintenance).toHaveBeenCalledOnce();
    expect(deps.maintenance).toHaveBeenCalledWith(
      new Date("2026-08-12T19:45:00.000Z"),
    );
  });
});
