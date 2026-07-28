import { describe, expect, it, vi } from "vitest";
import {
  createCalendarMaintenanceEvidence,
  emitCalendarMaintenanceEvidence,
  type CalendarMaintenanceEvidence,
} from "../../../src/jobs/calendar-maintenance-evidence";
import { runScheduledCalendarMaintenance } from "../../../src/jobs/scheduled";

const NOW = new Date("2026-07-24T16:15:00.000Z");
const EVIDENCE_KEYS = [
  "category",
  "evidenceType",
  "outcome",
  "renewalOutcome",
  "repairOutcome",
] as const;

describe("calendar maintenance evidence", () => {
  it.each([
    ["reserved", "completed"],
    ["reserved", "no_work"],
    ["no_work", "completed"],
    ["no_work", "no_work"],
  ] as const)(
    "reconstructs one exact five-key success for repair %s and renewal %s",
    (repairOutcome, renewalOutcome) => {
      const evidence = createCalendarMaintenanceEvidence(
        repairOutcome,
        renewalOutcome,
      );

      expect(evidence).toStrictEqual({
        evidenceType: "vision.calendar-maintenance/v1",
        outcome: "succeeded",
        category: "none",
        repairOutcome,
        renewalOutcome,
      });
      expect(Object.keys(evidence).sort()).toEqual(EVIDENCE_KEYS);
      expect(Object.isFrozen(evidence)).toBe(true);
    },
  );

  it.each([
    [
      "failed",
      "completed",
      {
        outcome: "failed",
        category: "repair_failed",
        repairOutcome: "failed",
        renewalOutcome: "completed",
      },
    ],
    [
      "failed",
      "no_work",
      {
        outcome: "failed",
        category: "repair_failed",
        repairOutcome: "failed",
        renewalOutcome: "no_work",
      },
    ],
    [
      "reserved",
      "failed",
      {
        outcome: "failed",
        category: "renewal_failed",
        repairOutcome: "reserved",
        renewalOutcome: "failed",
      },
    ],
    [
      "no_work",
      "failed",
      {
        outcome: "failed",
        category: "renewal_failed",
        repairOutcome: "no_work",
        renewalOutcome: "failed",
      },
    ],
    [
      "failed",
      "failed",
      {
        outcome: "failed",
        category: "repair_and_renewal_failed",
        repairOutcome: "failed",
        renewalOutcome: "failed",
      },
    ],
  ] as const)(
    "reconstructs one exact five-key failure for repair %s and renewal %s",
    (repairOutcome, renewalOutcome, expected) => {
      const evidence = createCalendarMaintenanceEvidence(
        repairOutcome,
        renewalOutcome,
      );

      expect(evidence).toStrictEqual({
        evidenceType: "vision.calendar-maintenance/v1",
        ...expected,
      });
      expect(Object.keys(evidence).sort()).toEqual(EVIDENCE_KEYS);
      expect(Object.isFrozen(evidence)).toBe(true);
    },
  );

  it("emits only the fixed maintenance action and closed evidence", () => {
    const write = vi.fn();
    const evidence = createCalendarMaintenanceEvidence("reserved", "no_work");

    emitCalendarMaintenanceEvidence(evidence, write);

    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith({
      action: "calendar.maintenance",
      evidence,
    });
  });
});

describe("scheduled calendar maintenance evidence", () => {
  it.each([
    ["reserved", "completed"],
    ["reserved", "no_work"],
    ["no_work", "completed"],
    ["no_work", "no_work"],
  ] as const)(
    "orders cleanup, repair, and renewal and emits once for %s/%s",
    async (repairOutcome, renewalOutcome) => {
      const order: string[] = [];
      const writeEvidence = vi.fn();

      await runScheduledCalendarMaintenance(NOW, {
        cleanupProjectionRebuilds: async () => {
          order.push("cleanup");
          return 0;
        },
        repair: async () => {
          order.push("repair");
          return repairOutcome;
        },
        renew: async () => {
          order.push("renew");
          return renewalOutcome;
        },
        writeEvidence,
      });

      expect(order).toEqual(["cleanup", "repair", "renew"]);
      expect(writeEvidence).toHaveBeenCalledOnce();
      expect(writeEvidence).toHaveBeenCalledWith({
        action: "calendar.maintenance",
        evidence: {
          evidenceType: "vision.calendar-maintenance/v1",
          outcome: "succeeded",
          category: "none",
          repairOutcome,
          renewalOutcome,
        },
      });
    },
  );

  it.each([
    {
      name: "cleanup",
      cleanupFailure: { safe: "cleanup" },
      repairFailure: { safe: "repair" },
      renewalFailure: { safe: "renewal" },
      expectedFailure: "cleanupFailure",
    },
    {
      name: "repair",
      repairFailure: { safe: "repair" },
      renewalFailure: { safe: "renewal" },
      expectedFailure: "repairFailure",
    },
    {
      name: "renewal",
      renewalFailure: { safe: "renewal" },
      expectedFailure: "renewalFailure",
    },
  ] as const)(
    "emits once before rethrowing the original $name failure by precedence",
    async (scenario) => {
      const order: string[] = [];
      const writeEvidence = vi.fn();
      const failures = scenario as typeof scenario & {
        readonly cleanupFailure?: object;
        readonly repairFailure?: object;
        readonly renewalFailure?: object;
      };

      const execution = runScheduledCalendarMaintenance(NOW, {
        cleanupProjectionRebuilds: async () => {
          order.push("cleanup");
          if (failures.cleanupFailure) throw failures.cleanupFailure;
          return 0;
        },
        repair: async () => {
          order.push("repair");
          if (failures.repairFailure) throw failures.repairFailure;
          return "no_work";
        },
        renew: async () => {
          order.push("renew");
          if (failures.renewalFailure) throw failures.renewalFailure;
          return "no_work";
        },
        writeEvidence,
      });

      await expect(execution).rejects.toBe(scenario[scenario.expectedFailure]);
      expect(order).toEqual(["cleanup", "repair", "renew"]);
      expect(writeEvidence).toHaveBeenCalledOnce();
      const entry = writeEvidence.mock.calls[0]?.[0] as {
        readonly action: string;
        readonly evidence: CalendarMaintenanceEvidence;
      };
      expect(entry.action).toBe("calendar.maintenance");
      const repairFailed =
        failures.cleanupFailure !== undefined ||
        failures.repairFailure !== undefined;
      const renewalFailed = failures.renewalFailure !== undefined;
      expect(entry.evidence).toStrictEqual({
        evidenceType: "vision.calendar-maintenance/v1",
        outcome: "failed",
        category: repairFailed
          ? renewalFailed
            ? "repair_and_renewal_failed"
            : "repair_failed"
          : "renewal_failed",
        repairOutcome: repairFailed ? "failed" : "no_work",
        renewalOutcome: renewalFailed ? "failed" : "no_work",
      });
    },
  );

  it("maps cleanup failure to repair without adding a sixth field", async () => {
    const cleanupFailure = { safe: "cleanup" };
    const writeEvidence = vi.fn();

    await expect(
      runScheduledCalendarMaintenance(NOW, {
        cleanupProjectionRebuilds: async () => {
          throw cleanupFailure;
        },
        repair: async () => "reserved",
        renew: async () => "completed",
        writeEvidence,
      }),
    ).rejects.toBe(cleanupFailure);

    const evidence = writeEvidence.mock.calls[0]?.[0]?.evidence as
      | CalendarMaintenanceEvidence
      | undefined;
    expect(evidence).toStrictEqual({
      evidenceType: "vision.calendar-maintenance/v1",
      outcome: "failed",
      category: "repair_failed",
      repairOutcome: "failed",
      renewalOutcome: "completed",
    });
    expect(Object.keys(evidence ?? {}).sort()).toEqual(EVIDENCE_KEYS);
  });

  it("propagates the original writer failure after successful maintenance", async () => {
    const writerFailure = { safe: "writer" };
    const writeEvidence = vi.fn(() => {
      throw writerFailure;
    });

    await expect(
      runScheduledCalendarMaintenance(NOW, {
        cleanupProjectionRebuilds: async () => 0,
        repair: async () => "reserved",
        renew: async () => "completed",
        writeEvidence,
      }),
    ).rejects.toBe(writerFailure);

    expect(writeEvidence).toHaveBeenCalledOnce();
    expect(writeEvidence).toHaveBeenCalledWith({
      action: "calendar.maintenance",
      evidence: {
        evidenceType: "vision.calendar-maintenance/v1",
        outcome: "succeeded",
        category: "none",
        repairOutcome: "reserved",
        renewalOutcome: "completed",
      },
    });
  });

  it.each([
    {
      name: "cleanup",
      cleanupFailure: { safe: "cleanup" },
      repairFailure: { safe: "repair" },
      renewalFailure: { safe: "renewal" },
      expectedFailure: "cleanupFailure",
    },
    {
      name: "repair",
      repairFailure: { safe: "repair" },
      renewalFailure: { safe: "renewal" },
      expectedFailure: "repairFailure",
    },
    {
      name: "renewal",
      renewalFailure: { safe: "renewal" },
      expectedFailure: "renewalFailure",
    },
  ] as const)(
    "preserves the original $name failure when the writer also fails",
    async (scenario) => {
      const failures = scenario as typeof scenario & {
        readonly cleanupFailure?: object;
        readonly repairFailure?: object;
        readonly renewalFailure?: object;
      };
      const writerFailure = { safe: "writer" };
      const writeEvidence = vi.fn(() => {
        throw writerFailure;
      });

      const execution = runScheduledCalendarMaintenance(NOW, {
        cleanupProjectionRebuilds: async () => {
          if (failures.cleanupFailure) throw failures.cleanupFailure;
          return 0;
        },
        repair: async () => {
          if (failures.repairFailure) throw failures.repairFailure;
          return "no_work";
        },
        renew: async () => {
          if (failures.renewalFailure) throw failures.renewalFailure;
          return "no_work";
        },
        writeEvidence,
      });

      await expect(execution).rejects.toBe(scenario[scenario.expectedFailure]);
      expect(writeEvidence).toHaveBeenCalledOnce();
    },
  );
});
