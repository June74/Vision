/** Prints a privacy-safe result, optionally requiring closed restore evidence. */
import { createInterface } from "node:readline";
import { createSafeTailAccumulator } from "./safe-tail-classifier";

const RESTORE_ONLY_ARGUMENT = "--restore-only";
const noArguments = process.argv.length === 2;
const restoreOnly =
  process.argv.length === 3 && process.argv[2] === RESTORE_ONLY_ARGUMENT;
if (!noArguments && !restoreOnly) {
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
    (restoreOnly && !("evidenceType" in evidence))
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
