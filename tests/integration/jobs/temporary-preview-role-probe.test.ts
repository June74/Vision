import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  runTemporaryPreviewRoleProbe,
  type TemporaryPreviewRoleProbeDependencies,
} from "../../../src/jobs/temporary-preview-role-probe";
import { TemporaryRoleProbeEnvSchema } from "../../../src/server/env";

const PRIVATE_SECRET = "private_role_probe_secret_sentinel";
const PRIVATE_ERROR = "private_role_probe_error_sentinel";

/** Builds a valid synthetic URL without recording an authenticated URL literal. */
function validEnvironment(): {
  readonly VISION_ENV: "preview";
  readonly PREVIEW_RESTORE_DATABASE_URL: string;
} {
  const databaseUrl = new URL("postgresql://localhost/vision");
  databaseUrl.username = "vision_app";
  databaseUrl.password = PRIVATE_SECRET;
  return {
    VISION_ENV: "preview",
    PREVIEW_RESTORE_DATABASE_URL: databaseUrl.toString(),
  };
}

/** Creates one fully injected read probe with no provider or network access. */
function dependencies(
  probeRole: TemporaryPreviewRoleProbeDependencies["probeRole"],
): TemporaryPreviewRoleProbeDependencies {
  return { probeRole: vi.fn(probeRole) };
}

describe("temporary preview role probe job", () => {
  it("accepts only the exact two-field preview environment", () => {
    expect(TemporaryRoleProbeEnvSchema.keyof().options.sort()).toEqual([
      "PREVIEW_RESTORE_DATABASE_URL",
      "VISION_ENV",
    ]);
    expect(TemporaryRoleProbeEnvSchema.safeParse(validEnvironment()).success).toBe(
      true,
    );
    expect(
      TemporaryRoleProbeEnvSchema.safeParse({
        ...validEnvironment(),
        PREVIEW_RESTORE_TARGET_ID: "forbidden-target",
      }).success,
    ).toBe(false);
    expect(
      TemporaryRoleProbeEnvSchema.safeParse({
        ...validEnvironment(),
        VISION_ENV: "production",
      }).success,
    ).toBe(false);
  });

  it("returns fixed configuration failure without calling the adapter", async () => {
    const injected = dependencies(async () => true);

    await expect(
      runTemporaryPreviewRoleProbe(
        {
          ...validEnvironment(),
          PREVIEW_RESTORE_DATABASE_URL: PRIVATE_SECRET,
        },
        injected,
      ),
    ).resolves.toEqual({
      evidenceType: "vision.preview-role-probe/v1",
      outcome: "failed",
      category: "role_probe_configuration_invalid",
      roleMatches: false,
    });
    expect(injected.probeRole).not.toHaveBeenCalled();
  });

  it("returns the exact success object only for an adapter true result", async () => {
    const environment = validEnvironment();
    const injected = dependencies(async () => true);

    await expect(
      runTemporaryPreviewRoleProbe(environment, injected),
    ).resolves.toEqual({
      evidenceType: "vision.preview-role-probe/v1",
      outcome: "succeeded",
      category: "none",
      roleMatches: true,
    });
    expect(injected.probeRole).toHaveBeenCalledOnce();
    expect(injected.probeRole).toHaveBeenCalledWith(
      environment.PREVIEW_RESTORE_DATABASE_URL,
    );
  });

  it("maps adapter false to the exact role-mismatch failure", async () => {
    await expect(
      runTemporaryPreviewRoleProbe(
        validEnvironment(),
        dependencies(async () => false),
      ),
    ).resolves.toEqual({
      evidenceType: "vision.preview-role-probe/v1",
      outcome: "failed",
      category: "role_probe_role_mismatch",
      roleMatches: false,
    });
  });

  it("maps thrown adapter failures to the exact query failure", async () => {
    await expect(
      runTemporaryPreviewRoleProbe(
        validEnvironment(),
        dependencies(async () => {
          throw new Error(`${PRIVATE_SECRET} ${PRIVATE_ERROR}`);
        }),
      ),
    ).resolves.toEqual({
      evidenceType: "vision.preview-role-probe/v1",
      outcome: "failed",
      category: "role_probe_query_failed",
      roleMatches: false,
    });
  });

  it("never logs or returns hostile errors and secret sentinels", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await runTemporaryPreviewRoleProbe(
      validEnvironment(),
      dependencies(async () => {
        throw new Error(`${PRIVATE_SECRET} ${PRIVATE_ERROR}`);
      }),
    );

    const rendered = JSON.stringify(result);
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(rendered).not.toContain(PRIVATE_SECRET);
    expect(rendered).not.toContain(PRIVATE_ERROR);
    info.mockRestore();
    error.mockRestore();
  });

  it("keeps restore, clear, R2, backup-key, target-ID, and HTTP capability unreachable", async () => {
    const [job, adapter, scheduler] = await Promise.all([
      readFile(
        resolve(process.cwd(), "src", "jobs", "temporary-preview-role-probe.ts"),
        "utf8",
      ),
      readFile(
        resolve(
          process.cwd(),
          "src",
          "data",
          "backup",
          "temporary-preview-role-probe-adapter.ts",
        ),
        "utf8",
      ),
      readFile(
        resolve(process.cwd(), "src", "jobs", "scheduled.ts"),
        "utf8",
      ),
    ]);

    for (const source of [job, adapter, scheduler]) {
      expect(source).not.toContain("PREVIEW_RESTORE_TARGET_ID");
      expect(source).not.toContain("temporary-preview-restore");
      expect(source).not.toContain("temporary-preview-clear-adapter");
      expect(source).not.toContain("createR2RestoreAttemptStore");
    }
    for (const source of [job, adapter]) {
      expect(source).not.toContain("BACKUP_ENCRYPTION_KEY");
      expect(source).not.toContain("BACKUP_BUCKET");
      expect(source).not.toContain("fetch(");
      expect(source).not.toContain("Hono");
    }
  });
});
