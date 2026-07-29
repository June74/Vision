/** Blocks temporary preview activation around the normal recovery schedule. */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const INVALID = "Preview acceptance timing is unavailable.";

/** Inclusive UTC minute at which temporary preview activation becomes unsafe. */
export const PREVIEW_ACCEPTANCE_BLOCKED_START_UTC_MINUTE = 5 * 60 + 35;

/** Exclusive UTC minute at which temporary preview activation becomes safe again. */
export const PREVIEW_ACCEPTANCE_BLOCKED_END_UTC_MINUTE = 6 * 60 + 35;

/** Fails closed for invalid time or any instant in the recovery overlap window. */
export function assertPreviewAcceptanceWindow(now: Date): void {
  const instant = Date.prototype.getTime.call(now);
  if (!Number.isFinite(instant)) throw new Error(INVALID);
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (
    minute >= PREVIEW_ACCEPTANCE_BLOCKED_START_UTC_MINUTE &&
    minute < PREVIEW_ACCEPTANCE_BLOCKED_END_UTC_MINUTE
  ) {
    throw new Error(INVALID);
  }
}

/** Checks the current clock without accepting caller-controlled arguments. */
function main(): void {
  try {
    if (process.argv.length !== 2) throw new Error(INVALID);
    assertPreviewAcceptanceWindow(new Date());
    process.stdout.write("Preview acceptance timing is available.\n");
  } catch {
    process.stderr.write(`${INVALID}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
