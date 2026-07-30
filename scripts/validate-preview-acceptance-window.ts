/** Guards temporary preview activation and its generated lifetime deadline. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertPreviewAcceptanceLifetime,
  assertPreviewAcceptanceWindow,
  createPreviewAcceptanceDeadline,
  previewAcceptanceMaxLifetimeMinutes,
  parseTemporaryPreviewAcceptanceSelector,
} from "../src/domain/operations/temporary-preview-fault";

export {
  assertPreviewAcceptanceLifetime,
  assertPreviewAcceptanceWindow,
  createPreviewAcceptanceDeadline,
  previewAcceptanceMaxLifetimeMinutes,
  PREVIEW_ACCEPTANCE_BLOCKED_END_UTC_MINUTE,
  PREVIEW_ACCEPTANCE_BLOCKED_START_UTC_MINUTE,
  PREVIEW_ACCEPTANCE_MAX_LIFETIME_MINUTES,
} from "../src/domain/operations/temporary-preview-fault";

const INVALID = "Preview acceptance timing is unavailable.";
const CANDIDATE_PATH = "dist/vision/wrangler.acceptance.json";

/** Admits only ordinary data objects with the default object prototype. */
function plainObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Reads one own enumerable data property without invoking accessors. */
function dataValue(
  record: Record<string, unknown> | undefined,
  key: string,
): unknown {
  const descriptor =
    record === undefined ? undefined : Object.getOwnPropertyDescriptor(record, key);
  return descriptor?.enumerable === true && "value" in descriptor
    ? descriptor.value
    : undefined;
}

/** Checks either a fresh maximum interval or the fixed generated artifact. */
async function main(): Promise<void> {
  try {
    const arguments_ = process.argv.slice(2);
    if (arguments_.length === 0) {
      const { parsePreviewAcceptanceContext } = await import(
        "./prepare-preview-acceptance-deploy-config"
      );
      const selection = parsePreviewAcceptanceContext(
        process.env.ACCEPTANCE_OPERATION as never,
        process.env.ACCEPTANCE_CONTEXT ?? "",
      );
      if (selection.selector === undefined) throw new Error(INVALID);
      assertPreviewAcceptanceWindow(new Date(), selection.selector);
    } else if (
      arguments_.length === 2 &&
      arguments_[0] === "--candidate" &&
      arguments_[1] === CANDIDATE_PATH
    ) {
      const config = plainObject(
        JSON.parse(await readFile(resolve(CANDIDATE_PATH), "utf8")) as unknown,
      );
      const vars = plainObject(dataValue(config, "vars"));
      const selector = parseTemporaryPreviewAcceptanceSelector(vars);
      if (selector === undefined) throw new Error(INVALID);
      assertPreviewAcceptanceLifetime(
        new Date(),
        dataValue(vars, "PREVIEW_ACCEPTANCE_EXPIRES_AT"),
        selector,
      );
    } else {
      throw new Error(INVALID);
    }
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
  void main();
}
