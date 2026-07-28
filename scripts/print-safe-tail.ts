/** Prints a privacy-safe result, optionally requiring closed restore evidence. */
import { createInterface } from "node:readline";
import { createSafeTailAccumulator } from "./safe-tail-classifier";

const RESTORE_ONLY_ARGUMENT = "--restore-only";
const ROLE_PROBE_ONLY_ARGUMENT = "--role-probe-only";
const CALENDAR_MAINTENANCE_ONLY_ARGUMENT = "--calendar-maintenance-only";
const FOUNDATION_PROBE_ONLY_ARGUMENT = "--foundation-probe-only";
const AI_USAGE_ONLY_ARGUMENT = "--ai-usage-only";
const noArguments = process.argv.length === 2;
const restoreOnly =
  process.argv.length === 3 && process.argv[2] === RESTORE_ONLY_ARGUMENT;
const roleProbeOnly =
  process.argv.length === 3 &&
  process.argv[2] === ROLE_PROBE_ONLY_ARGUMENT;
const calendarMaintenanceOnly =
  process.argv.length === 3 &&
  process.argv[2] === CALENDAR_MAINTENANCE_ONLY_ARGUMENT;
const foundationProbeOnly =
  process.argv.length === 3 &&
  process.argv[2] === FOUNDATION_PROBE_ONLY_ARGUMENT;
const aiUsageOnly = process.argv.length === 3 && process.argv[2] === AI_USAGE_ONLY_ARGUMENT;
if (
  !noArguments &&
  !restoreOnly &&
  !roleProbeOnly &&
  !calendarMaintenanceOnly &&
  !foundationProbeOnly &&
  !aiUsageOnly
) {
  process.exit(1);
}
let emitted = false;
const accumulator = createSafeTailAccumulator();
const lines = createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

lines.on("line", (line) => {
  const evidence = accumulator.push(line);
  if (
    !evidence ||
    emitted ||
    (restoreOnly &&
      (!("evidenceType" in evidence) ||
        evidence.evidenceType !== "vision.preview-restore/v1")) ||
    (roleProbeOnly &&
      (!("evidenceType" in evidence) ||
        evidence.evidenceType !== "vision.preview-role-probe/v1")) ||
    (calendarMaintenanceOnly &&
      (!("evidenceType" in evidence) ||
        evidence.evidenceType !== "vision.calendar-maintenance/v1")) ||
    (foundationProbeOnly &&
      (!("evidenceType" in evidence) ||
        evidence.evidenceType !==
          "vision.phase-b-foundation-probe/v1")) ||
    (aiUsageOnly && (!("evidenceType" in evidence) || evidence.evidenceType !== "vision.ai-usage/v1"))
  ) {
    return;
  }
  emitted = true;
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
  process.exit(0);
});

lines.on("close", () => {
  if (!emitted) {
    process.stdout.write(
      '{"category":"no_scheduled_event","cron":"none","outcome":"unknown"}\n',
    );
  }
});
