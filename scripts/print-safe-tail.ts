/** Prints the first allowlisted recovery or restore result and nothing raw. */
import { createInterface } from "node:readline";
import { createSafeTailAccumulator } from "./safe-tail-classifier";

let emitted = false;
const accumulator = createSafeTailAccumulator();
const lines = createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

lines.on("line", (line) => {
  const evidence = accumulator.push(line);
  if (!evidence || emitted) return;
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
