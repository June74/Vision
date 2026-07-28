/** Runs one preview-only read probe and returns only fixed value-free evidence. */
import { TemporaryRoleProbeEnvSchema } from "../server/env";

/** Fixed failure vocabulary for configuration, query, and role mismatch outcomes. */
export type TemporaryPreviewRoleProbeFailureCategory =
  | "role_probe_configuration_invalid"
  | "role_probe_query_failed"
  | "role_probe_role_mismatch";

/** Closed evidence emitted by the temporary preview role probe. */
export interface TemporaryPreviewRoleProbeEvidence {
  readonly evidenceType: "vision.preview-role-probe/v1";
  readonly outcome: "succeeded" | "failed";
  readonly category:
    | "none"
    | TemporaryPreviewRoleProbeFailureCategory;
  readonly roleMatches: boolean;
}

/** Injected read boundary keeps the job free of provider and database capabilities. */
export interface TemporaryPreviewRoleProbeDependencies {
  readonly probeRole: (connectionString: string) => Promise<boolean>;
}

/** The one-minute cron used only by the temporary preview probe candidate. */
export const TEMPORARY_PREVIEW_ROLE_PROBE_CRON = "* * * * *";

/** Validates the isolated binding, runs one read, and maps every result to closed evidence. */
export async function runTemporaryPreviewRoleProbe(
  environment: unknown,
  dependencies: TemporaryPreviewRoleProbeDependencies,
): Promise<TemporaryPreviewRoleProbeEvidence> {
  const parsed = TemporaryRoleProbeEnvSchema.safeParse(environment);
  if (!parsed.success) {
    return failedEvidence("role_probe_configuration_invalid");
  }
  try {
    if (
      await dependencies.probeRole(
        parsed.data.PREVIEW_RESTORE_DATABASE_URL,
      )
    ) {
      return Object.freeze({
        evidenceType: "vision.preview-role-probe/v1",
        outcome: "succeeded",
        category: "none",
        roleMatches: true,
      });
    }
    return failedEvidence("role_probe_role_mismatch");
  } catch {
    return failedEvidence("role_probe_query_failed");
  }
}

/** Creates one immutable failure without retaining configuration or errors. */
function failedEvidence(
  category: TemporaryPreviewRoleProbeFailureCategory,
): TemporaryPreviewRoleProbeEvidence {
  return Object.freeze({
    evidenceType: "vision.preview-role-probe/v1",
    outcome: "failed",
    category,
    roleMatches: false,
  });
}
