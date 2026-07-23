import { readFileSync } from "node:fs";

/** Documents the exported function but not this module. */
export function importedDocumentedFunction(): string {
  return typeof readFileSync;
}
