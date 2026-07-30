/** Permanent value-free evidence for the normal calendar-maintenance cron. */
export interface CalendarMaintenanceEvidence {
  readonly evidenceType: "vision.calendar-maintenance/v2";
  readonly maintenanceScheduledAt: string;
  readonly outcome: "succeeded" | "failed";
  readonly category:
    | "none"
    | "repair_failed"
    | "renewal_failed"
    | "repair_and_renewal_failed";
  readonly repairOutcome: "reserved" | "no_work" | "failed";
  readonly renewalOutcome: "completed" | "no_work" | "failed";
}

/** Repair-side outcomes retained without owner, calendar, or Queue counts. */
export type CalendarMaintenanceRepairOutcome =
  CalendarMaintenanceEvidence["repairOutcome"];

/** Renewal-side outcomes retained without channel or provider counts. */
export type CalendarMaintenanceRenewalOutcome =
  CalendarMaintenanceEvidence["renewalOutcome"];

/** The only log entry shape emitted for permanent maintenance evidence. */
export interface CalendarMaintenanceEvidenceEntry {
  readonly action: "calendar.maintenance";
  readonly evidence: CalendarMaintenanceEvidence;
}

/** Reconstructs the closed five-key evidence object from the two terminal sides. */
export function createCalendarMaintenanceEvidence(
  maintenanceScheduledAt: Date,
  repairOutcome: CalendarMaintenanceRepairOutcome,
  renewalOutcome: CalendarMaintenanceRenewalOutcome,
): CalendarMaintenanceEvidence {
  const repairFailed = repairOutcome === "failed";
  const renewalFailed = renewalOutcome === "failed";
  const category: CalendarMaintenanceEvidence["category"] =
    repairFailed && renewalFailed
      ? "repair_and_renewal_failed"
      : repairFailed
        ? "repair_failed"
        : renewalFailed
          ? "renewal_failed"
          : "none";
  const scheduledAt = canonicalScheduledInstant(maintenanceScheduledAt);
  return Object.freeze({
    evidenceType: "vision.calendar-maintenance/v2",
    maintenanceScheduledAt: scheduledAt,
    outcome: repairFailed || renewalFailed ? "failed" : "succeeded",
    category,
    repairOutcome,
    renewalOutcome,
  });
}

/** Converts the admitted scheduled controller time to canonical UTC. */
function canonicalScheduledInstant(value: Date): string {
  let instant: number;
  try {
    instant = Date.prototype.getTime.call(value);
  } catch {
    throw new Error("Calendar maintenance evidence is invalid.");
  }
  if (!Number.isFinite(instant)) {
    throw new Error("Calendar maintenance evidence is invalid.");
  }
  return new Date(instant).toISOString();
}

/** Emits only the fixed maintenance action and already-closed evidence. */
export function emitCalendarMaintenanceEvidence(
  evidence: CalendarMaintenanceEvidence,
  write: (entry: CalendarMaintenanceEvidenceEntry) => void = console.info,
): void {
  write({ action: "calendar.maintenance", evidence });
}
