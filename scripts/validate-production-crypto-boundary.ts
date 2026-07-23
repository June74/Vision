/** Verifies that Vitest-only crypto support is unreachable from production source and bundles. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Unique text emitted by the guarded test provider and forbidden in production output. */
export const TEST_PROVIDER_BOUNDARY_MARKER =
  "VISION_TEST_PROVIDER_MODULE_MUST_NOT_REACH_PRODUCTION_BUNDLE";

const TEST_PROVIDER_MODULE = "src/crypto/test-key-provider.ts";

/** Validates source reachability and, when present or required, the built Worker artifact. */
export function validateProductionCryptoBoundary(
  projectRoot = process.cwd(),
  requireBundle = false,
): string[] {
  const root = resolve(projectRoot);
  const violations: string[] = [];
  const sourceRoot = resolve(root, "src");

  for (const path of collectFiles(sourceRoot)) {
    const sourceRelativePath = relative(root, path).replaceAll("\\", "/");
    if (sourceRelativePath === TEST_PROVIDER_MODULE || !/\.tsx?$/u.test(path)) {
      continue;
    }

    const source = readFileSync(path, "utf8");
    if (source.includes("test-key-provider")) {
      violations.push(`${sourceRelativePath}: production source references the Vitest-only key provider`);
    }
  }

  const bundleRoot = resolve(root, "dist", "vision");
  if (!existsSync(bundleRoot)) {
    if (requireBundle) {
      violations.push("dist/vision: production Worker bundle is missing");
    }
    return violations;
  }

  for (const path of collectFiles(bundleRoot)) {
    const bundle = readFileSync(path, "utf8");
    if (
      bundle.includes(TEST_PROVIDER_BOUNDARY_MARKER) ||
      bundle.includes("createTestKeyProvider") ||
      bundle.includes("test-key-provider")
    ) {
      violations.push(
        `${relative(root, path).replaceAll("\\", "/")}: production bundle contains Vitest-only key-provider code`,
      );
    }
  }

  return violations;
}

/** Recursively collects ordinary files without following directory links. */
function collectFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory() ? collectFiles(path) : [path];
  });
}

/** Runs the post-build boundary check and reports constant, secret-free violations. */
function run(): void {
  const violations = validateProductionCryptoBoundary(process.cwd(), true);
  if (violations.length === 0) {
    return;
  }

  console.error("Production crypto boundary validation failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
