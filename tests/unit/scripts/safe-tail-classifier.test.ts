import { describe, expect, it } from "vitest";
import {
  classifyCalendarMaintenanceEvidence,
  classifyPhaseBFoundationProbeEvidence,
  classifyPhaseBAiUsageEvidence,
  classifyTemporaryPreviewFaultEvidence,
  classifySafeTailLine,
  classifyTemporaryPreviewRoleProbeEvidence,
  classifyTemporaryRestoreEvidence,
  createSafeTailAccumulator,
  matchesPreviewAcceptanceExpectation,
} from "../../../scripts/safe-tail-classifier";
import { BACKUP_TABLES } from "../../../src/domain/backup/manifest";
import type {
  TemporaryRestoreEvidence,
  TemporaryRestoreFailureCategory,
} from "../../../src/jobs/temporary-preview-restore";
import type { CalendarMaintenanceEvidence } from "../../../src/jobs/calendar-maintenance-evidence";
import {
  PHASE_B_AI_USAGE_ACTION,
  type PhaseBAiUsageEvidence,
} from "../../../src/jobs/phase-b-ai-usage-evidence";
import type { TemporaryPreviewRoleProbeEvidence } from "../../../src/jobs/temporary-preview-role-probe";
import type { PhaseBFoundationProbeEvidence } from "../../../src/jobs/phase-b-foundation-probe";
import type { TemporaryPreviewFaultEvidence } from "../../../src/jobs/temporary-preview-fault";

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

/** Builds one exact permanent maintenance result. */
function maintenanceEvidence(
  repairOutcome: CalendarMaintenanceEvidence["repairOutcome"] = "reserved",
  renewalOutcome: CalendarMaintenanceEvidence["renewalOutcome"] = "completed",
): CalendarMaintenanceEvidence {
  const repairFailed = repairOutcome === "failed";
  const renewalFailed = renewalOutcome === "failed";
  return {
    evidenceType: "vision.calendar-maintenance/v2",
    maintenanceScheduledAt: "2026-07-30T18:15:00.000Z",
    outcome: repairFailed || renewalFailed ? "failed" : "succeeded",
    category:
      repairFailed && renewalFailed
        ? "repair_and_renewal_failed"
        : repairFailed
          ? "repair_failed"
          : renewalFailed
            ? "renewal_failed"
            : "none",
    repairOutcome,
    renewalOutcome,
  };
}

/** Wraps permanent maintenance evidence in the scheduled tail shape. */
function maintenanceTail(
  evidence: unknown,
  cron = "*/15 * * * *",
  records: readonly unknown[] = [
    { action: "calendar.maintenance", evidence },
  ],
): string {
  return JSON.stringify({
    outcome: "ok",
    event: { cron },
    logs: records.map((record) => ({ message: [record] })),
  });
}

/** Builds one exact temporary foundation-probe result. */
function foundationEvidence(): PhaseBFoundationProbeEvidence {
  return {
    evidenceType: "vision.phase-b-foundation-probe/v1",
    outcome: "succeeded",
    category: "none",
    roleMatches: true,
    schemaMatches: true,
    privilegesMatch: true,
    publicGrantCount: 0,
    identityViolations: 0,
    domainViolations: 0,
    privacyViolations: 0,
    provenanceViolations: 0,
    referenceViolations: 0,
    checkpointViolations: 0,
    protectedStorageMatches: true,
    sentinelStatus: "passed",
    backupContractMatches: true,
    databaseBytes: 1,
    r2ObjectCount: 1,
    r2Bytes: 1,
  };
}

/** Wraps one foundation record in its future one-minute candidate tail. */
function foundationTail(
  evidence: unknown,
  cron = "* * * * *",
  records: readonly unknown[] = [
    { action: "acceptance.phase-b-foundation", evidence },
  ],
): string {
  return JSON.stringify({
    outcome: "ok",
    event: { cron },
    logs: records.map((record) => ({ message: [record] })),
  });
}

/** Returns all canonical AI evidence categories accepted from safe tail output. */
function canonicalAiUsageEvidence(): readonly PhaseBAiUsageEvidence[] {
  return [
    {
      evidenceType: "vision.ai-usage/v1",
      outcome: "succeeded",
      category: "none",
      monthlyCents: 950,
      warningAtCents: 800,
      optionalStopAtCents: 900,
      hardStopAtCents: 950,
      tier: "stopped",
      gatewayLimitMatches: true,
      nonAiAvailable: true,
    },
    {
      evidenceType: "vision.ai-usage/v1",
      outcome: "failed",
      category: "limit_exceeded",
      monthlyCents: 951,
      warningAtCents: 800,
      optionalStopAtCents: 900,
      hardStopAtCents: 950,
      tier: "stopped",
      gatewayLimitMatches: true,
      nonAiAvailable: true,
    },
    {
      evidenceType: "vision.ai-usage/v1",
      outcome: "failed",
      category: "inconsistent",
      monthlyCents: 0,
      warningAtCents: 800,
      optionalStopAtCents: 900,
      hardStopAtCents: 950,
      tier: "normal",
      gatewayLimitMatches: false,
      nonAiAvailable: false,
    },
    {
      evidenceType: "vision.ai-usage/v1",
      outcome: "failed",
      category: "unavailable",
      monthlyCents: 0,
      warningAtCents: 800,
      optionalStopAtCents: 900,
      hardStopAtCents: 950,
      tier: "normal",
      gatewayLimitMatches: false,
      nonAiAvailable: false,
    },
  ];
}

/** Wraps AI records in the future one-minute candidate tail. */
function aiUsageTail(
  evidence: PhaseBAiUsageEvidence,
  records: readonly unknown[] = [
    { action: PHASE_B_AI_USAGE_ACTION, evidence },
  ],
  cron = "* * * * *",
): string {
  return JSON.stringify({
    outcome: "ok",
    event: { cron },
    logs: records.map((record) => ({ message: [record] })),
  });
}

function faultEvidence(
  scenario: TemporaryPreviewFaultEvidence["scenario"] = "queue_delayed",
): TemporaryPreviewFaultEvidence {
  return scenario === "r2_upload_failed"
    ? {
        evidenceType: "vision.preview-fault/v1",
        scenario,
        outcome: "failed",
        category: "backup_storage_write_failed",
      }
    : {
        evidenceType: "vision.preview-fault/v1",
        scenario,
        outcome: "succeeded",
        category: "none",
      };
}

function faultTail(evidence: unknown, records: readonly unknown[] = [{ action: "acceptance.preview-fault", evidence }]): string {
  return JSON.stringify({
    event: { cron: "* * * * *" },
    logs: [{ message: records }],
  });
}

describe("safe Cloudflare tail classification", () => {
  it.each([
    "queue_delayed",
    "job_failed",
    "channel_expired",
    "database_unavailable",
    "r2_upload_failed",
    "ai_stopped",
  ] as const)("reconstructs only the canonical %s preview fault evidence", (scenario) => {
    const evidence = faultEvidence(scenario);

    expect(classifyTemporaryPreviewFaultEvidence(evidence)).toEqual(evidence);
    expect(classifySafeTailLine(faultTail(evidence))).toEqual(evidence);
  });

  it("rejects invalid, duplicate, and mixed preview-fault terminal records", () => {
    const evidence = faultEvidence();

    expect(classifyTemporaryPreviewFaultEvidence({ ...evidence, outcome: "failed" })).toBeNull();
    expect(
      classifySafeTailLine(
        faultTail(evidence, [
          { action: "acceptance.preview-fault", evidence },
          { action: "acceptance.preview-fault", evidence },
        ]),
      ),
    ).toBeNull();
    expect(
      classifySafeTailLine(
        faultTail(evidence, [
          { action: "acceptance.preview-fault", evidence },
          { action: "calendar.maintenance", evidence: maintenanceEvidence() },
        ]),
      ),
    ).toBeNull();
  });

  it("accepts every canonical AI evidence category without field drift", () => {
    for (const evidence of canonicalAiUsageEvidence()) {
      expect(classifyPhaseBAiUsageEvidence(evidence)).toEqual(evidence);
      expect(classifySafeTailLine(aiUsageTail(evidence))).toEqual(evidence);
    }
  });

  it.each(["foundation-first", "ai-first"] as const)(
    "rejects one-minute %s tails containing canonical foundation and AI terminals",
    (order) => {
      const foundation = foundationEvidence();
      const aiUsage = canonicalAiUsageEvidence()[0];
      const foundationRecord = {
        action: "acceptance.phase-b-foundation",
        evidence: foundation,
      };
      const aiUsageRecord = {
        action: PHASE_B_AI_USAGE_ACTION,
        evidence: aiUsage,
      };
      const records =
        order === "foundation-first"
          ? [foundationRecord, aiUsageRecord]
          : [aiUsageRecord, foundationRecord];

      expect(
        classifySafeTailLine(aiUsageTail(aiUsage, records)),
      ).toBeNull();
    },
  );

  it("rejects AI combined with every other terminal kind in either order", () => {
    const aiUsage = canonicalAiUsageEvidence()[0];
    const aiUsageRecord = {
      action: PHASE_B_AI_USAGE_ACTION,
      evidence: aiUsage,
    };
    const terminalCases = [
      {
        cron: "* * * * *",
        record: {
          action: "acceptance.phase-b-foundation",
          evidence: foundationEvidence(),
        },
      },
      {
        cron: "* * * * *",
        record: {
          action: "backup.restore",
          evidence: successfulRestoreEvidence(),
        },
      },
      {
        cron: "* * * * *",
        record: {
          action: "backup.restore-role-probe",
          evidence: {
            evidenceType: "vision.preview-role-probe/v1",
            outcome: "succeeded",
            category: "none",
            roleMatches: true,
          },
        },
      },
      {
        cron: "*/15 * * * *",
        record: {
          action: "calendar.maintenance",
          evidence: maintenanceEvidence(),
        },
      },
    ] as const;

    for (const { cron, record } of terminalCases) {
      for (const records of [
        [aiUsageRecord, record],
        [record, aiUsageRecord],
      ]) {
        expect(
          classifySafeTailLine(
            JSON.stringify({
              outcome: "ok",
              event: { cron },
              logs: records.map((message) => ({ message: [message] })),
            }),
          ),
        ).toBeNull();
      }
    }
  });

  it("rejects duplicate, wrong-action, wrong-cron, and extra-key AI terminals", () => {
    const aiUsage = canonicalAiUsageEvidence()[0];
    const record = {
      action: PHASE_B_AI_USAGE_ACTION,
      evidence: aiUsage,
    };

    expect(
      classifySafeTailLine(aiUsageTail(aiUsage, [record, record])),
    ).toBeNull();
    expect(
      classifySafeTailLine(
        aiUsageTail(aiUsage, [{ action: "wrong.action", evidence: aiUsage }]),
      ),
    ).toBeNull();
    expect(
      classifySafeTailLine(
        aiUsageTail(aiUsage, undefined, "5 6 * * *"),
      ),
    ).toBeNull();
    expect(
      classifySafeTailLine(
        aiUsageTail(aiUsage, [{ ...record, extra: true }]),
      ),
    ).toBeNull();
    expect(
      classifySafeTailLine(
        aiUsageTail({ ...aiUsage, extra: true } as PhaseBAiUsageEvidence),
      ),
    ).toBeNull();
  });

  it("rejects AI accessors, symbols, hidden keys, and non-plain prototypes without invoking them", () => {
    const aiUsage = canonicalAiUsageEvidence()[0];
    let getterCalls = 0;
    const accessor = {
      ...aiUsage,
      get monthlyCents() {
        getterCalls += 1;
        return 950;
      },
    };
    const symbol = { ...aiUsage, [Symbol("private")]: true };
    const hidden = { ...aiUsage };
    Object.defineProperty(hidden, "private", {
      enumerable: false,
      value: true,
    });
    const prototype = Object.assign(Object.create({ inherited: true }), aiUsage);

    expect(classifyPhaseBAiUsageEvidence(accessor)).toBeNull();
    expect(getterCalls).toBe(0);
    expect(classifyPhaseBAiUsageEvidence(symbol)).toBeNull();
    expect(classifyPhaseBAiUsageEvidence(hidden)).toBeNull();
    expect(classifyPhaseBAiUsageEvidence(prototype)).toBeNull();
  });

  it.each([
    ["reserved", "completed"],
    ["reserved", "no_work"],
    ["no_work", "completed"],
    ["no_work", "no_work"],
    ["failed", "completed"],
    ["failed", "no_work"],
    ["reserved", "failed"],
    ["no_work", "failed"],
    ["failed", "failed"],
  ] as const)(
    "reconstructs one exact five-key maintenance result for %s/%s",
    (repairOutcome, renewalOutcome) => {
      const evidence = maintenanceEvidence(repairOutcome, renewalOutcome);
      const classified = classifyCalendarMaintenanceEvidence(evidence);

      expect(classified).toEqual(evidence);
      expect(classified).not.toBe(evidence);
      expect(Object.keys(classified ?? {})).toEqual([
        "category",
        "evidenceType",
        "maintenanceScheduledAt",
        "outcome",
        "renewalOutcome",
        "repairOutcome",
      ]);
      expect(classifySafeTailLine(maintenanceTail(evidence))).toEqual(evidence);
    },
  );

  it("rejects missing, extra, raw-error, and incoherent maintenance fields", () => {
    const success = maintenanceEvidence();
    const rejected = [
      { ...success, extra: true },
      { ...success, error: "raw provider error" },
      {
        evidenceType: success.evidenceType,
        outcome: success.outcome,
        category: success.category,
        repairOutcome: success.repairOutcome,
      },
      { ...success, outcome: "failed" },
      { ...success, category: "repair_failed" },
      { ...success, repairOutcome: "failed" },
      { ...success, renewalOutcome: "failed" },
      { ...success, category: "private_provider_failure" },
      { ...success, repairOutcome: "unknown" },
      { ...success, renewalOutcome: "unknown" },
    ];

    for (const candidate of rejected) {
      expect(classifyCalendarMaintenanceEvidence(candidate)).toBeNull();
      expect(classifySafeTailLine(maintenanceTail(candidate))).toBeNull();
    }
    expect(
      classifySafeTailLine(
        maintenanceTail(success, "*/15 * * * *", [
          {
            action: "calendar.maintenance",
            evidence: success,
            error: "raw provider error",
          },
        ]),
      ),
    ).toBeNull();
  });

  it("rejects maintenance accessors, symbols, hidden keys, and non-plain prototypes without invoking them", () => {
    let getterCalls = 0;
    const accessor = {
      evidenceType: "vision.calendar-maintenance/v2",
      maintenanceScheduledAt: "2026-07-30T18:15:00.000Z",
      outcome: "succeeded",
      category: "none",
      get repairOutcome() {
        getterCalls += 1;
        return "reserved";
      },
      renewalOutcome: "completed",
    };
    const symbol = {
      ...maintenanceEvidence(),
      [Symbol("private")]: true,
    };
    const hidden = { ...maintenanceEvidence() };
    Object.defineProperty(hidden, "private", {
      enumerable: false,
      value: true,
    });
    const prototype = Object.assign(Object.create({ inherited: true }), {
      ...maintenanceEvidence(),
    });

    expect(classifyCalendarMaintenanceEvidence(accessor)).toBeNull();
    expect(getterCalls).toBe(0);
    expect(classifyCalendarMaintenanceEvidence(symbol)).toBeNull();
    expect(classifyCalendarMaintenanceEvidence(hidden)).toBeNull();
    expect(classifyCalendarMaintenanceEvidence(prototype)).toBeNull();
  });

  it("rejects maintenance evidence on wrong crons and duplicate or mixed terminal records", () => {
    const maintenance = maintenanceEvidence();
    const roleProbe = {
      action: "backup.restore-role-probe",
      evidence: {
        evidenceType: "vision.preview-role-probe/v1",
        outcome: "succeeded",
        category: "none",
        roleMatches: true,
      },
    };

    expect(
      classifySafeTailLine(maintenanceTail(maintenance, "* * * * *")),
    ).toBeNull();
    expect(
      classifySafeTailLine(maintenanceTail(maintenance, "5 6 * * *")),
    ).toBeNull();
    expect(
      classifySafeTailLine(
        maintenanceTail(maintenance, "*/15 * * * *", [
          { action: "calendar.maintenance", evidence: maintenance },
          { action: "calendar.maintenance", evidence: maintenance },
        ]),
      ),
    ).toBeNull();
    expect(
      classifySafeTailLine(
        maintenanceTail(maintenance, "*/15 * * * *", [
          { action: "calendar.maintenance", evidence: maintenance },
          roleProbe,
        ]),
      ),
    ).toBeNull();
    expect(
      classifySafeTailLine(
        maintenanceTail(maintenance, "*/15 * * * *", [
          roleProbe,
          { action: "calendar.maintenance", evidence: maintenance },
        ]),
      ),
    ).toBeNull();
    expect(
      classifySafeTailLine(
        maintenanceTail(maintenance, "*/15 * * * *", [
          { action: "calendar.other", evidence: maintenance },
        ]),
      ),
    ).toBeNull();
  });

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

  it("reconstructs the exact foundation evidence without preserving its source object", () => {
    const evidence = foundationEvidence();
    const direct = classifyPhaseBFoundationProbeEvidence(evidence);
    const classified = classifySafeTailLine(foundationTail(evidence));

    expect(direct).toEqual(evidence);
    expect(direct).not.toBe(evidence);
    expect(classified).toEqual(evidence);
    expect(Object.keys(classified ?? {}).sort()).toEqual(
      Object.keys(evidence).sort(),
    );
  });

  it("rejects incoherent, hostile, extra-key, and raw-error foundation evidence", () => {
    const success = foundationEvidence();
    let getterCalls = 0;
    const accessor = {
      ...success,
      get databaseBytes() {
        getterCalls += 1;
        return 1;
      },
    };
    const prototype = Object.assign(Object.create({ inherited: true }), success);
    const symbol = { ...success, [Symbol("private")]: true };
    for (const candidate of [
      { ...success, extra: true },
      { ...success, roleMatches: false },
      { ...success, outcome: "failed" },
      { ...success, category: "private_provider_error" },
      { ...success, providerError: "private_provider_detail" },
      { ...success, databaseBytes: -1 },
      { ...success, r2ObjectCount: 1.5 },
    ]) {
      expect(classifyPhaseBFoundationProbeEvidence(candidate)).toBeNull();
      expect(classifySafeTailLine(foundationTail(candidate))).toBeNull();
    }
    for (const candidate of [accessor, prototype, symbol]) {
      expect(classifyPhaseBFoundationProbeEvidence(candidate)).toBeNull();
    }
    expect(getterCalls).toBe(0);
  });

  it("accepts only numeric-bound evidence containing a possible sanitized zero", () => {
    const impossible = {
      ...foundationEvidence(),
      outcome: "failed" as const,
      category: "numeric_bound_exceeded" as const,
      publicGrantCount: 1,
      identityViolations: 1,
      domainViolations: 1,
      privacyViolations: 1,
      provenanceViolations: 1,
      referenceViolations: 1,
      checkpointViolations: 1,
      databaseBytes: 1,
      r2ObjectCount: 1,
      r2Bytes: 1,
    };
    const possible = {
      ...impossible,
      identityViolations: 0,
    };

    expect(
      classifyPhaseBFoundationProbeEvidence(impossible),
    ).toBeNull();
    expect(classifySafeTailLine(foundationTail(impossible))).toBeNull();
    expect(classifyPhaseBFoundationProbeEvidence(possible)).toEqual(
      possible,
    );
    expect(classifySafeTailLine(foundationTail(possible))).toEqual(
      possible,
    );
  });

  it("rejects foundation evidence on wrong cron, duplicate, mixed, or wrong-action records", () => {
    const foundation = foundationEvidence();
    const role: TemporaryPreviewRoleProbeEvidence = {
      evidenceType: "vision.preview-role-probe/v1",
      outcome: "succeeded",
      category: "none",
      roleMatches: true,
    };

    expect(
      classifySafeTailLine(
        foundationTail(foundation, "*/15 * * * *"),
      ),
    ).toBeNull();
    expect(
      classifySafeTailLine(
        foundationTail(foundation, "* * * * *", [
          { action: "wrong.action", evidence: foundation },
        ]),
      ),
    ).toBeNull();
    expect(
      classifySafeTailLine(
        foundationTail(foundation, "* * * * *", [
          { action: "acceptance.phase-b-foundation", evidence: foundation },
          { action: "acceptance.phase-b-foundation", evidence: foundation },
        ]),
      ),
    ).toBeNull();
    expect(
      classifySafeTailLine(
        foundationTail(foundation, "* * * * *", [
          { action: "acceptance.phase-b-foundation", evidence: foundation },
          { action: "backup.restore-role-probe", evidence: role },
        ]),
      ),
    ).toBeNull();
  });
});

describe("closed preview acceptance outcomes", () => {
  it("accepts only the exact synchronization-suppression terminal", () => {
    expect(
      matchesPreviewAcceptanceExpectation(
        {
          evidenceType: "vision.sync-suppression/v1",
          outcome: "suppressed",
        },
        { kind: "sync_suppressed" },
      ),
    ).toBe(true);
    expect(
      matchesPreviewAcceptanceExpectation(
        {
          evidenceType: "vision.sync-suppression/v1",
          outcome: "suppressed",
          extra: true,
        } as never,
        { kind: "sync_suppressed" },
      ),
    ).toBe(false);
  });

  it("requires the requested fault scenario and its deterministic terminal state", () => {
    expect(
      matchesPreviewAcceptanceExpectation(
        {
          evidenceType: "vision.preview-fault/v1",
          scenario: "r2_upload_failed",
          outcome: "failed",
          category: "backup_storage_write_failed",
        },
        { kind: "fault_expected", scenario: "r2_upload_failed" },
      ),
    ).toBe(true);
    expect(
      matchesPreviewAcceptanceExpectation(
        {
          evidenceType: "vision.preview-fault/v1",
          scenario: "r2_upload_failed",
          outcome: "succeeded",
          category: "none",
        },
        { kind: "fault_expected", scenario: "r2_upload_failed" },
      ),
    ).toBe(false);
  });

  it("requires exact family success invariants instead of structural validity", () => {
    expect(
      matchesPreviewAcceptanceExpectation(
        {
          evidenceType: "vision.preview-role-probe/v1",
          outcome: "succeeded",
          category: "none",
          roleMatches: true,
        },
        { kind: "role_probe_succeeded" },
      ),
    ).toBe(true);
    expect(
      matchesPreviewAcceptanceExpectation(
        {
          evidenceType: "vision.preview-restore/v1",
          outcome: "failed",
          category: "restore_unknown_failure",
        },
        { kind: "restore_succeeded" },
      ),
    ).toBe(false);
    expect(
      matchesPreviewAcceptanceExpectation(
        {
          evidenceType: "vision.calendar-maintenance/v2",
          maintenanceScheduledAt: "2026-07-30T18:15:00.000Z",
          outcome: "succeeded",
          category: "none",
          repairOutcome: "no_work",
          renewalOutcome: "completed",
        },
        {
          kind: "maintenance_repair_reserved",
          maintenanceScheduledAt: "2026-07-30T18:15:00.000Z",
        },
      ),
    ).toBe(false);
  });
});
