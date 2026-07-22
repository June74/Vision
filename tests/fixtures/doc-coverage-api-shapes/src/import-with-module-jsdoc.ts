/** Describes this imported module. */
import { readFileSync } from "node:fs";

/** Describes the exported function. */
export function importedModuleFunction(): string {
  return typeof readFileSync;
}
