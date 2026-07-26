/** Prints the first allowlisted scheduled-event classification and nothing raw. */
import { createInterface } from "node:readline";
import { classifySafeTailLine } from "./safe-tail-classifier";

let emitted = false;
const lines = createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

lines.on("line", (line) => {
  const evidence = classifySafeTailLine(line);
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
