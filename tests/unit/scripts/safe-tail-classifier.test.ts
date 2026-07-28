import { describe, expect, it } from "vitest";
import {
  classifySafeTailLine,
  classifyTemporaryPreviewRoleProbeEvidence,
  classifyTemporaryRestoreEvidence,
  createSafeTailAccumulator,
} from "../../../scripts/safe-tail-classifier";
import { BACKUP_TABLES } from "../../../src/domain/backup/manifest";
import type {
  TemporaryRestoreEvidence,
  TemporaryRestoreFailureCategory,
} from "../../../src/jobs/temporary-preview-restore";
import type { TemporaryPreviewRoleProbeEvidence } from "../../../src/jobs/temporary-preview-role-probe";

const FAILURE_CATEGORIES: readonly TemporaryRestoreFailureCategory[] = [
  "restore_configuration_invalid",
  "restore_candidate_invalid",
  "restore_object_verification_failed",
  "restore_backup_validation_failed",
  "restore_target_attestation_failed",
  "restore_target_not_empty",
  "restore_promotion_failed",
  "restore_readback_verification_failed",
  "restore_unknown_failure",
];

function rowCounts(): Record<(typeof BACKUP_TABLES)[number], number> {
  return Object.fromEntries(
    BACKUP_TABLES.map((table, index) => [table, index]),
  ) as Record<(typeof BACKUP_TABLES)[number], number>;
}

function successfulRestoreEvidence(): TemporaryRestoreEvidence {
  return {
    evidenceType: "vision.preview-restore/v1",
    outcome: "succeeded",
    category: "none",
    format: "vision-backup/v1",
    schemaVersion: 9,
    keyVersion: 7,
    authoritativeTableCount: 29,
    rowCounts: rowCounts(),
    checksumMatches: true,
    referencesValid: true,
    targetWasEmpty: true,
    eventListReadable: true,
    eventCount: 3,
    replacedExisting: false,
  };
}

function restoreTail(evidence: unknown, recordExtra?: unknown): string {
  return JSON.stringify({
    outcome: "ok",
    event: { cron: "* * * * *" },
    logs: [
      {
        message: [
          {
            action: "backup.restore",
            evidence,
            ...(recordExtra === undefined ? {} : { extra: recordExtra }),
          },
        ],
      },
    ],
  });
}

/** Wraps one synthetic role-probe result in the scheduled tail shape. */
function roleProbeTail(
  evidence: unknown,
  action: unknown = "backup.restore-role-probe",
): string {
  return JSON.stringify({
    outcome: "ok",
    event: { cron: "* * * * *" },
    logs: [{ message: [{ action, evidence }] }],
  });
}

describe("safe Cloudflare tail classification", () => {
  it("returns only allowlisted recovery evidence", () => {
    const raw = JSON.stringify({
      outcome: "exception",
      event: {
        cron: "* * * * *",
        url: "https://private.example.test/secret",
      },
      logs: [
        {
          message: [
            "Error: Backup creation failed.",
            "Bearer private-token",
          ],
        },
      ],
    });

    expect(classifySafeTailLine(raw)).toEqual({
      category: "backup_creation_failed",
      cron: "temporary_recovery",
      outcome: "exception",
    });
    expect(JSON.stringify(classifySafeTailLine(raw))).not.toContain(
      "private",
    );
  });

  it("ignores non-json output and non-scheduled events", () => {
    expect(classifySafeTailLine("wrangler banner")).toBeNull();
    expect(
      classifySafeTailLine(
        JSON.stringify({
          outcome: "ok",
          event: { request: { url: "https://private.example.test" } },
        }),
      ),
    ).toBeNull();
  });

  it("classifies a successful scheduled recovery without copying logs", () => {
    expect(
      classifySafeTailLine(
        JSON.stringify({
          outcome: "ok",
          event: { cron: "5 6 * * *" },
          logs: [{ message: ["untrusted content"] }],
        }),
      ),
    ).toEqual({
      category: "none",
      cron: "daily_recovery",
      outcome: "ok",
    });
  });

  it("assembles Wrangler's multiline JSON without exposing raw fields", () => {
    const accumulator = createSafeTailAccumulator();
    const lines = JSON.stringify(
      {
        outcome: "exception",
        event: { cron: "* * * * *" },
        exceptions: [
          { message: "Backup verification failed. private-object-key" },
        ],
      },
      null,
      4,
    ).split("\n");

    for (const line of lines.slice(0, -1)) {
      expect(accumulator.push(line)).toBeNull();
    }
    const evidence = accumulator.push(lines.at(-1) ?? "");
    expect(evidence).toEqual({
      category: "backup_verification_failed",
      cron: "temporary_recovery",
      outcome: "exception",
    });
    expect(JSON.stringify(evidence)).not.toContain("private-object-key");
  });

  it("returns only a reconstructed exact successful restore evidence object", () => {
    const expected = successfulRestoreEvidence();
    const classified = classifySafeTailLine(
      JSON.stringify({
        outcome: "ok",
        event: { cron: "* * * * *" },
        logs: [
          {
            message: [
              { action: "backup.restore", evidence: expected },
              "discarded provider content",
            ],
          },
        ],
        unrelated: "discarded",
      }),
    );

    expect(classified).toEqual(expected);
    expect(classified).not.toBe(expected);
    expect(Object.getPrototypeOf(classified)).toBe(Object.prototype);
    expect(
      Object.getPrototypeOf(
        (classified as TemporaryRestoreEvidence).rowCounts,
      ),
    ).toBe(Object.prototype);
  });

  it("accepts only the closed failure evidence categories", () => {
    for (const category of FAILURE_CATEGORIES) {
      const evidence = {
        evidenceType: "vision.preview-restore/v1",
        outcome: "failed",
        category,
      };
      expect(classifyTemporaryRestoreEvidence(evidence)).toEqual(evidence);
    }
  });

  it("rejects extra, free-form, and private-shaped restore fields", () => {
    const shapedValues = [
      ["https", ":", "//", "example", ".", "invalid"].join(""),
      ["target", "_", "private", "_", "1"].join(""),
      ["backups", "/", "v1", "/", "object"].join(""),
    ];
    const rejected = [
      { ...successfulRestoreEvidence(), extra: true },
      {
        evidenceType: "vision.preview-restore/v1",
        outcome: "failed",
        category: "restore_unknown_failure",
        error: "free form",
      },
      ...shapedValues.map((value) => ({
        evidenceType: "vision.preview-restore/v1",
        outcome: "failed",
        category: "restore_unknown_failure",
        detail: value,
      })),
    ];

    for (const candidate of rejected) {
      expect(classifyTemporaryRestoreEvidence(candidate) === null).toBe(true);
    }
    expect(
      classifySafeTailLine(restoreTail(successfulRestoreEvidence(), true)) ===
        null,
    ).toBe(true);
  });

  it("rejects incomplete, extra, negative, fractional, and unsafe row counts", () => {
    const missing = Object.fromEntries(
      BACKUP_TABLES.slice(1).map((table, index) => [table, index]),
    );
    const invalidCounts = [
      missing,
      { ...rowCounts(), extra: 0 },
      { ...rowCounts(), [BACKUP_TABLES[0]]: -1 },
      { ...rowCounts(), [BACKUP_TABLES[0]]: 0.5 },
      {
        ...rowCounts(),
        [BACKUP_TABLES[0]]: Number.MAX_SAFE_INTEGER + 1,
      },
    ];

    for (const candidateRowCounts of invalidCounts) {
      expect(
        classifyTemporaryRestoreEvidence({
          ...successfulRestoreEvidence(),
          rowCounts: candidateRowCounts,
        }) === null,
      ).toBe(true);
    }
  });

  it("rejects successful evidence with any failed verification fact", () => {
    const requiredTrue = [
      "checksumMatches",
      "referencesValid",
      "targetWasEmpty",
      "eventListReadable",
    ] as const;
    for (const key of requiredTrue) {
      expect(
        classifyTemporaryRestoreEvidence({
          ...successfulRestoreEvidence(),
          [key]: false,
        }) === null,
      ).toBe(true);
    }
    expect(
      classifyTemporaryRestoreEvidence({
        ...successfulRestoreEvidence(),
        replacedExisting: true,
      }) === null,
    ).toBe(true);
  });

  it("rejects invalid evidence counts and failure-only shape drift", () => {
    for (const invalid of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        classifyTemporaryRestoreEvidence({
          ...successfulRestoreEvidence(),
          eventCount: invalid,
        }) === null,
      ).toBe(true);
      expect(
        classifyTemporaryRestoreEvidence({
          ...successfulRestoreEvidence(),
          keyVersion: invalid,
        }) === null,
      ).toBe(true);
    }
    expect(
      classifyTemporaryRestoreEvidence({
        evidenceType: "vision.preview-restore/v1",
        outcome: "failed",
        category: "restore_unknown_failure",
        checksumMatches: true,
      }) === null,
    ).toBe(true);
  });

  it("requires the restore record to be the exact first log message", () => {
    const evidence = successfulRestoreEvidence();
    const secondMessage = JSON.stringify({
      outcome: "ok",
      event: { cron: "* * * * *" },
      logs: [
        {
          message: [
            "not the restore record",
            { action: "backup.restore", evidence },
          ],
        },
      ],
    });

    expect(classifySafeTailLine(secondMessage)).toEqual({
      category: "none",
      cron: "temporary_recovery",
      outcome: "ok",
    });
    expect(
      classifySafeTailLine(
        JSON.stringify({
          outcome: "ok",
          event: { cron: "*/15 * * * *" },
          logs: [
            { message: [{ action: "backup.restore", evidence }] },
          ],
        }),
      ),
    ).toBeNull();
    expect(
      classifySafeTailLine(
        JSON.stringify({
          outcome: "ok",
          event: { request: { method: "GET" } },
          logs: [
            { message: [{ action: "backup.restore", evidence }] },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("reconstructs only the exact four-key role-probe success and failures", () => {
    const success: TemporaryPreviewRoleProbeEvidence = {
      evidenceType: "vision.preview-role-probe/v1",
      outcome: "succeeded",
      category: "none",
      roleMatches: true,
    };
    const classified = classifySafeTailLine(roleProbeTail(success));

    expect(classified).toEqual(success);
    expect(classified).not.toBe(success);
    expect(Object.keys(classified ?? {})).toEqual([
      "category",
      "evidenceType",
      "outcome",
      "roleMatches",
    ]);
    for (const category of [
      "role_probe_configuration_invalid",
      "role_probe_query_failed",
      "role_probe_role_mismatch",
    ] as const) {
      expect(
        classifyTemporaryPreviewRoleProbeEvidence({
          evidenceType: "vision.preview-role-probe/v1",
          outcome: "failed",
          category,
          roleMatches: false,
        }),
      ).toEqual({
        category,
        evidenceType: "vision.preview-role-probe/v1",
        outcome: "failed",
        roleMatches: false,
      });
    }
  });

  it("rejects missing, extra, and inconsistent role-probe fields", () => {
    const success = {
      evidenceType: "vision.preview-role-probe/v1",
      outcome: "succeeded",
      category: "none",
      roleMatches: true,
    } as const;
    for (const candidate of [
      { ...success, extra: true },
      {
        evidenceType: success.evidenceType,
        outcome: success.outcome,
        category: success.category,
      },
      { ...success, roleMatches: false },
      { ...success, outcome: "failed" },
      {
        ...success,
        outcome: "failed",
        category: "role_probe_query_failed",
        roleMatches: true,
      },
      {
        ...success,
        outcome: "failed",
        category: "private-provider-error",
        roleMatches: false,
      },
    ]) {
      expect(classifyTemporaryPreviewRoleProbeEvidence(candidate)).toBeNull();
    }
  });

  it("rejects wrong actions, wrong crons, and raw provider text", () => {
    const privateText = "private_provider_text_sentinel";
    const success = {
      evidenceType: "vision.preview-role-probe/v1",
      outcome: "succeeded",
      category: "none",
      roleMatches: true,
    };

    expect(
      classifySafeTailLine(roleProbeTail(success, "backup.restore")),
    ).toBeNull();
    expect(
      classifySafeTailLine(
        JSON.stringify({
          outcome: "ok",
          event: { cron: "*/15 * * * *" },
          logs: [
            {
              message: [
                { action: "backup.restore-role-probe", evidence: success },
              ],
            },
          ],
        }),
      ),
    ).toBeNull();
    expect(
      classifySafeTailLine(
        roleProbeTail({ ...success, providerError: privateText }),
      ),
    ).toBeNull();
    expect(JSON.stringify(classifySafeTailLine(roleProbeTail(success)))).not.toContain(
      privateText,
    );
  });

  it("rejects role-probe accessors, symbols, and non-plain prototypes without invoking them", () => {
    let getterCalls = 0;
    const accessor = {
      evidenceType: "vision.preview-role-probe/v1",
      outcome: "succeeded",
      category: "none",
      get roleMatches() {
        getterCalls += 1;
        return true;
      },
    };
    const symbol = {
      evidenceType: "vision.preview-role-probe/v1",
      outcome: "succeeded",
      category: "none",
      roleMatches: true,
      [Symbol("private")]: true,
    };
    const prototype = Object.assign(Object.create({ inherited: true }), {
      evidenceType: "vision.preview-role-probe/v1",
      outcome: "succeeded",
      category: "none",
      roleMatches: true,
    });

    expect(classifyTemporaryPreviewRoleProbeEvidence(accessor)).toBeNull();
    expect(getterCalls).toBe(0);
    expect(classifyTemporaryPreviewRoleProbeEvidence(symbol)).toBeNull();
    expect(classifyTemporaryPreviewRoleProbeEvidence(prototype)).toBeNull();
  });
});
