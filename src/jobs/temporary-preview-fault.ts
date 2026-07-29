/** Runs one generated preview fault candidate without exposing an activation route. */
import type { BackupObjectWriter } from "./create-daily-backup";
import {
  parseTemporaryPreviewFaultScenario,
  type TemporaryPreviewFaultScenario,
} from "../domain/operations/temporary-preview-fault";

/** The fixed scheduled-log action accepted by the temporary candidate observer. */
export const TEMPORARY_PREVIEW_FAULT_ACTION = "acceptance.preview-fault" as const;
/** The generated candidate's one-minute schedule; normal deployments never route it. */
export const TEMPORARY_PREVIEW_FAULT_CRON = "* * * * *" as const;

/** Exact terminal evidence retained for one preview fault candidate. */
export interface TemporaryPreviewFaultEvidence {
  readonly evidenceType: "vision.preview-fault/v1";
  readonly scenario: TemporaryPreviewFaultScenario;
  readonly outcome: "succeeded" | "failed";
  readonly category: "none" | "backup_storage_write_failed";
}

/** Closed scheduled-log envelope that cannot carry provider or private identifiers. */
export interface TemporaryPreviewFaultEntry {
  readonly action: typeof TEMPORARY_PREVIEW_FAULT_ACTION;
  readonly evidence: TemporaryPreviewFaultEvidence;
}

/** The only dependency used by the R2 fault; diagnostic overlays have no job capability. */
export interface TemporaryPreviewFaultDependencies {
  readonly runR2Upload: (writer: BackupObjectWriter) => Promise<void>;
}

/** Creates the only permitted scenario/outcome/category matrix. */
export function createTemporaryPreviewFaultEvidence(
  scenario: TemporaryPreviewFaultScenario,
): TemporaryPreviewFaultEvidence {
  return Object.freeze(
    scenario === "r2_upload_failed"
      ? {
          evidenceType: "vision.preview-fault/v1" as const,
          scenario,
          outcome: "failed" as const,
          category: "backup_storage_write_failed" as const,
        }
      : {
          evidenceType: "vision.preview-fault/v1" as const,
          scenario,
          outcome: "succeeded" as const,
          category: "none" as const,
        },
  );
}

/**
 * Admits one preview-only binding before touching a dependency, then emits one
 * terminal record. The R2 scenario injects a writer which rejects before any
 * provider put operation can begin.
 */
export async function runTemporaryPreviewFault(
  environment: unknown,
  dependencies: TemporaryPreviewFaultDependencies,
  write: (entry: TemporaryPreviewFaultEntry) => void = console.info,
): Promise<void> {
  const scenario = parseTemporaryPreviewFaultScenario(environment);
  if (!scenario) {
    throw new Error("Temporary preview fault scenario is unavailable.");
  }
  const evidence = createTemporaryPreviewFaultEvidence(scenario);
  if (scenario !== "r2_upload_failed") {
    write({ action: TEMPORARY_PREVIEW_FAULT_ACTION, evidence });
    return;
  }

  try {
    await dependencies.runR2Upload(TEMPORARY_PREVIEW_R2_FAILURE_WRITER);
  } catch {
    write({ action: TEMPORARY_PREVIEW_FAULT_ACTION, evidence });
    throw new Error("Backup storage write failed.");
  }
  write({ action: TEMPORARY_PREVIEW_FAULT_ACTION, evidence });
  throw new Error("Backup storage write failed.");
}

/** Rejects before calling the real R2 adapter's put boundary or mutating an object. */
const TEMPORARY_PREVIEW_R2_FAILURE_WRITER: BackupObjectWriter = Object.freeze({
  /** Always rejects before the real R2 adapter can receive a put request. */
  async putIfAbsent(): Promise<boolean> {
    throw new Error("Temporary preview backup upload failure.");
  },
});
