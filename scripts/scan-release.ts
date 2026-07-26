/** Scans local Phase B release evidence for protected data and forbidden calendar-write surfaces. */
import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ReleaseScanOptions {
  readonly projectRoot: string;
  readonly protectedSentinel: string;
}

export interface ReleaseViolation {
  readonly category:
    | "client-secret-binding"
    | "event-write-route"
    | "google-event-write"
    | "missing-evidence"
    | "protected-value";
  readonly file: string;
  readonly reason: string;
}

export interface ReleaseScanResult {
  readonly violations: readonly ReleaseViolation[];
}

/** Returns all safe, path-only release-boundary violations found beneath one project root. */
export async function scanRelease(
  options: ReleaseScanOptions,
): Promise<ReleaseScanResult> {
  const projectRoot = resolve(options.projectRoot);
  const violations: ReleaseViolation[] = [];
  const protectedVariants = new Set([
    options.protectedSentinel,
    encodeURIComponent(options.protectedSentinel),
    [...Buffer.from(options.protectedSentinel, "utf8")]
      .map((byte) => `%${byte.toString(16).padStart(2, "0").toUpperCase()}`)
      .join(""),
    Buffer.from(options.protectedSentinel, "utf8").toString("base64"),
    Buffer.from(options.protectedSentinel, "utf8").toString("base64url"),
  ]);
  const secretBindingNames = [
    "BACKUP_ENCRYPTION_KEY",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "DATABASE_URL",
    "GOOGLE_ALLOWED_EMAIL",
    "GOOGLE_ALLOWED_SUB",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "KEY_ENCRYPTION_KEY",
    "PREVIEW_RESTORE_DATABASE_URL",
  ] as const;
  const scanRoots = [
    {
      relativePath: "dist/client",
      protectedValues: true,
      secretBindings: true,
      sourceKind: undefined,
    },
    ...[
      "application-logs",
      "audit",
      "queue",
      "database-raw",
      "r2-unencrypted",
    ].map((name) => ({
      relativePath: `tests/fixtures/release-evidence/${name}`,
      protectedValues: true,
      secretBindings: false,
      sourceKind: undefined,
    })),
    {
      relativePath: "src/integrations/google",
      protectedValues: false,
      secretBindings: false,
      sourceKind: "google" as const,
    },
    {
      relativePath: "src/integrations/google-calendar",
      protectedValues: false,
      secretBindings: false,
      sourceKind: "google" as const,
    },
    {
      relativePath: "src/server",
      protectedValues: false,
      secretBindings: false,
      sourceKind: "routes" as const,
    },
  ] as const;
  const approvedGoogleFiles = new Map<string, readonly RegExp[]>([
    [
      "src/integrations/google/oauth-client.ts",
      [
        /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth$/u,
        /^https:\/\/oauth2\.googleapis\.com\/token$/u,
        /^https:\/\/www\.googleapis\.com\/oauth2\/v3\/certs$/u,
      ],
    ],
    [
      "src/integrations/google-calendar/calendar-client.ts",
      [
        /^https:\/\/www\.googleapis\.com\/calendar\/v3$/u,
        /^\$\{GOOGLE_CALENDAR_BASE_URL\}\/users\/me\/calendarList(?:\/(?:\$\{[^}]+\}|[^/]+))?$/u,
        /^\$\{GOOGLE_CALENDAR_BASE_URL\}\/calendars$/u,
        /^\$\{GOOGLE_CALENDAR_BASE_URL\}\/calendars\/(?:\$\{[^}]+\}|[^/]+)\/events\/watch$/u,
        /^\$\{GOOGLE_CALENDAR_BASE_URL\}\/channels\/stop$/u,
      ],
    ],
    [
      "src/integrations/google-calendar/event-sync-client.ts",
      [
        /^https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/(?:\$\{[^}]+\}|[^/]+)\/events$/u,
      ],
    ],
  ]);
  const sourceFiles: Array<{
    readonly relativePath: string;
    readonly sourceKind: "google" | "routes";
    readonly text: string;
  }> = [];

  for (const scanRoot of scanRoots) {
    const absoluteRoot = resolve(projectRoot, scanRoot.relativePath);
    try {
      const rootStat = await stat(absoluteRoot);
      if (!rootStat.isDirectory()) throw new Error("not-directory");
    } catch {
      violations.push({
        category: "missing-evidence",
        file: scanRoot.relativePath,
        reason: "required release evidence is absent or unreadable",
      });
      continue;
    }

    const directories = [absoluteRoot];
    const files: string[] = [];
    while (directories.length > 0) {
      const directory = directories.pop();
      if (!directory) break;
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch {
        violations.push({
          category: "missing-evidence",
          file: relative(projectRoot, directory).replaceAll("\\", "/"),
          reason: "required release evidence is unreadable",
        });
        continue;
      }
      for (const entry of entries) {
        const path = resolve(directory, entry.name);
        if (entry.isSymbolicLink()) {
          violations.push({
            category: "missing-evidence",
            file: relative(projectRoot, path).replaceAll("\\", "/"),
            reason: "symbolic links are not accepted release evidence",
          });
        } else if (entry.isDirectory()) {
          directories.push(path);
        } else if (entry.isFile()) {
          files.push(path);
        }
      }
    }
    if (files.length === 0) {
      violations.push({
        category: "missing-evidence",
        file: scanRoot.relativePath,
        reason: "required release evidence contains no files",
      });
      continue;
    }

    for (const file of files.sort()) {
      const relativePath = relative(projectRoot, file).replaceAll("\\", "/");
      let bytes: Buffer;
      try {
        const fileStat = await stat(file);
        if (fileStat.size > 16 * 1024 * 1024) {
          throw new Error("oversized");
        }
        bytes = await readFile(file);
      } catch {
        violations.push({
          category: "missing-evidence",
          file: relativePath,
          reason: "required release evidence is unreadable or oversized",
        });
        continue;
      }
      const text = bytes.toString("utf8");

      if (
        scanRoot.protectedValues &&
        [...protectedVariants].some((variant) =>
          bytes.includes(Buffer.from(variant, "utf8")),
        )
      ) {
        violations.push({
          category: "protected-value",
          file: relativePath,
          reason: "protected sentinel encoding is present",
        });
      }
      if (
        scanRoot.secretBindings &&
        secretBindingNames.some((binding) => text.includes(binding))
      ) {
        violations.push({
          category: "client-secret-binding",
          file: relativePath,
          reason: "server-only binding name is present in a client asset",
        });
      }
      if (scanRoot.sourceKind && /\.tsx?$/u.test(relativePath)) {
        sourceFiles.push({
          relativePath,
          sourceKind: scanRoot.sourceKind,
          text,
        });
      }
    }
  }

  for (const source of sourceFiles) {
    if (source.sourceKind === "routes") {
      const routePattern =
        /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*(["'`])([^"'`]+)\2/giu;
      for (const match of source.text.matchAll(routePattern)) {
        const method = match[1]?.toUpperCase();
        const route = match[3] ?? "";
        const allowedCategoryCorrection =
          method === "PATCH" &&
          route === "/api/calendar/events/:id/category";
        if (
          route.includes("/events") &&
          method !== "GET" &&
          !allowedCategoryCorrection
        ) {
          violations.push({
            category: "event-write-route",
            file: source.relativePath,
            reason: "Phase B event-write route is present",
          });
        }
      }
      continue;
    }

    const forbiddenSdkMethod =
      /\bevents\s*\.\s*(?:insert|update|patch|move|delete)\s*\(/iu;
    const forbiddenEventHttp =
      /\/events(?!\/watch)(?:[^"'`]*)["'`][\s\S]{0,600}?\bmethod\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/iu;
    if (
      forbiddenSdkMethod.test(source.text) ||
      forbiddenEventHttp.test(source.text)
    ) {
      violations.push({
        category: "google-event-write",
        file: source.relativePath,
        reason: "Google Calendar event mutation call is present",
      });
    }

    const providerSurfacePresent =
      /(?:googleapis\.com|GOOGLE_CALENDAR_BASE_URL|calendar\s*\.\s*events)/u.test(
        source.text,
      );
    const allowedEndpoints = approvedGoogleFiles.get(source.relativePath);
    if (providerSurfacePresent && !allowedEndpoints) {
      violations.push({
        category: "google-event-write",
        file: source.relativePath,
        reason: "Google call exists outside the explicit Phase B adapter allowlist",
      });
      continue;
    }
    if (!allowedEndpoints) continue;

    const endpointPattern =
      /(?:https:\/\/(?:accounts\.google\.com\/o\/oauth2\/v2\/auth|oauth2\.googleapis\.com\/token|www\.googleapis\.com\/(?:oauth2\/v3\/certs|calendar\/v3[^"'`]*))|\$\{GOOGLE_CALENDAR_BASE_URL\}[^"'`]*)/gu;
    for (const match of source.text.matchAll(endpointPattern)) {
      const endpoint = match[0] ?? "";
      if (!allowedEndpoints.some((pattern) => pattern.test(endpoint))) {
        violations.push({
          category: "google-event-write",
          file: source.relativePath,
          reason: "Google endpoint is outside the explicit Phase B call allowlist",
        });
      }
    }
  }

  const uniqueViolations = [
    ...new Map(
      violations.map((violation) => [
        `${violation.category}:${violation.file}`,
        violation,
      ]),
    ).values(),
  ];
  return {
    violations: uniqueViolations.sort((left, right) =>
      `${left.category}:${left.file}`.localeCompare(
        `${right.category}:${right.file}`,
      ),
    ),
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await scanRelease({
    projectRoot: process.cwd(),
    protectedSentinel: "VISION_PROTECTED_SENTINEL_31C2:calendar value",
  });
  if (result.violations.length === 0) {
    console.log("Release security scan passed.");
  } else {
    console.error("Release security scan failed:");
    for (const violation of result.violations) {
      console.error(`- ${violation.category}: ${violation.file}`);
    }
    process.exitCode = 1;
  }
}
