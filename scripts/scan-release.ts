/** Scans local Phase B release evidence for protected data and forbidden calendar-write surfaces. */
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import { CLIENT_FORBIDDEN_BINDING_NAMES } from "../src/server/client-binding-boundary";

/** Established plaintext canary used by Vision's encrypted-event privacy tests. */
export const PROTECTED_RELEASE_SENTINEL = "VISION_PROTECTED_SENTINEL_7F9A";

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

type SourceKind = "google" | "routes";

const APPROVED_GOOGLE_OPERATIONS = new Map<
  string,
  readonly { readonly method: string; readonly endpoint: RegExp }[]
>([
  [
    "src/integrations/google/oauth-client.ts",
    [
      {
        method: "POST",
        endpoint: /^https:\/\/oauth2\.googleapis\.com\/token$/u,
      },
      {
        method: "GET",
        endpoint: /^https:\/\/www\.googleapis\.com\/oauth2\/v3\/certs$/u,
      },
    ],
  ],
  [
    "src/integrations/google-calendar/calendar-client.ts",
    [
      {
        method: "GET",
        endpoint:
          /^\$\{GOOGLE_CALENDAR_BASE_URL\}\/users\/me\/calendarList$/u,
      },
      {
        method: "GET",
        endpoint:
          /^\$\{GOOGLE_CALENDAR_BASE_URL\}\/users\/me\/calendarList\/(?:\$\{[^}]+\}|[^/]+)$/u,
      },
      {
        method: "POST",
        endpoint: /^\$\{GOOGLE_CALENDAR_BASE_URL\}\/calendars$/u,
      },
      {
        method: "POST",
        endpoint:
          /^\$\{GOOGLE_CALENDAR_BASE_URL\}\/calendars\/(?:\$\{[^}]+\}|[^/]+)\/events\/watch$/u,
      },
      {
        method: "POST",
        endpoint: /^\$\{GOOGLE_CALENDAR_BASE_URL\}\/channels\/stop$/u,
      },
    ],
  ],
  [
    "src/integrations/google-calendar/event-sync-client.ts",
    [
      {
        method: "GET",
        endpoint:
          /^https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/(?:\$\{[^}]+\}|[^/]+)\/events$/u,
      },
    ],
  ],
]);

const EVIDENCE_TARGETS = [
  {
    relativePath:
      "tests/fixtures/release-evidence/application-logs/captured.ndjson",
    surface: "application_logs",
  },
  {
    relativePath: "tests/fixtures/release-evidence/audit/audit.ndjson",
    surface: "audit",
  },
  {
    relativePath: "tests/fixtures/release-evidence/queue/queue.ndjson",
    surface: "queue",
  },
  {
    relativePath:
      "tests/fixtures/release-evidence/database-raw/rows.ndjson",
    surface: "database_raw",
  },
  {
    relativePath:
      "tests/fixtures/release-evidence/r2-unencrypted/object.json",
    surface: "r2_unencrypted",
  },
] as const;

/** Converts an untrusted filesystem path into a bounded, non-reflective CI identifier. */
function safeFileIdentifier(
  projectRoot: string,
  absolutePath: string,
  forbiddenFragments: readonly string[],
): string {
  const candidate = relative(projectRoot, absolutePath).replaceAll("\\", "/");
  if (
    /^[A-Za-z0-9._/-]{1,240}$/u.test(candidate) &&
    !candidate.split("/").includes("..") &&
    !forbiddenFragments.some(
      (fragment) => fragment.length > 0 && candidate.includes(fragment),
    )
  ) {
    return candidate;
  }
  const digest = createHash("sha256")
    .update(candidate, "utf8")
    .digest("hex")
    .slice(0, 16);
  return `unsafe-path-${digest}`;
}

/** Resolves only bounded literal, template, concatenation, URL, and known-constant expressions. */
function canonicalExpression(
  expression: ts.Expression | undefined,
  staticValues: ReadonlyMap<string, string>,
  sourceFile: ts.SourceFile,
): string | undefined {
  if (!expression) return undefined;
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return expression.text;
  }
  if (ts.isTemplateExpression(expression)) {
    return expression.getText(sourceFile).slice(1, -1);
  }
  if (ts.isIdentifier(expression)) {
    return staticValues.get(expression.text);
  }
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return canonicalExpression(expression.expression, staticValues, sourceFile);
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = canonicalExpression(
      expression.left,
      staticValues,
      sourceFile,
    );
    const right = canonicalExpression(
      expression.right,
      staticValues,
      sourceFile,
    );
    return left === undefined || right === undefined
      ? undefined
      : `${left}${right}`;
  }
  if (
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression) &&
    expression.expression.name.text === "toString" &&
    expression.arguments.length === 0
  ) {
    return canonicalExpression(
      expression.expression.expression,
      staticValues,
      sourceFile,
    );
  }
  if (
    ts.isNewExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "URL"
  ) {
    return canonicalExpression(
      expression.arguments?.[0],
      staticValues,
      sourceFile,
    );
  }
  return undefined;
}

/** Reads one statically known HTTP method from an object-literal request initializer. */
function readHttpMethod(
  expression: ts.Expression | undefined,
  staticValues: ReadonlyMap<string, string>,
  sourceFile: ts.SourceFile,
): string | undefined {
  if (!expression || !ts.isObjectLiteralExpression(expression)) {
    return undefined;
  }
  for (const property of expression.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      (property.name.getText(sourceFile) === "method" ||
        property.name.getText(sourceFile) === '"method"' ||
        property.name.getText(sourceFile) === "'method'")
    ) {
      return canonicalExpression(
        property.initializer,
        staticValues,
        sourceFile,
      )?.toUpperCase();
    }
    if (
      ts.isShorthandPropertyAssignment(property) &&
      property.name.text === "method"
    ) {
      return staticValues.get("method")?.toUpperCase();
    }
  }
  return undefined;
}

/** Validates a named evidence export's explicit local-contract provenance envelope. */
function hasValidEvidenceProvenance(
  text: string,
  expectedSurface: string,
): boolean {
  const lines = text.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (lines.length === 0 || lines.length > 1_000) return false;
  return lines.every((line) => {
    try {
      const value = JSON.parse(line) as unknown;
      if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
      ) {
        return false;
      }
      const record = value as Record<string, unknown>;
      const provenance = record.provenance;
      const capturedAt = record.capturedAt;
      const provenanceRecord =
        typeof provenance === "object" &&
        provenance !== null &&
        !Array.isArray(provenance)
          ? (provenance as Record<string, unknown>)
          : undefined;
      const provenanceValues = provenanceRecord
        ? [
            provenanceRecord.generator,
            provenanceRecord.runId,
            provenanceRecord.source,
          ]
        : [];
      return (
        record.evidenceVersion === 1 &&
        record.surface === expectedSurface &&
        typeof capturedAt === "string" &&
        new Date(capturedAt).toISOString() === capturedAt &&
        provenanceValues.length === 3 &&
        provenanceValues.every(
          (entry) =>
            typeof entry === "string" &&
            entry.length > 0 &&
            entry.length <= 256 &&
            /^[A-Za-z0-9._/-]+$/u.test(entry),
        ) &&
        typeof record.record === "object" &&
        record.record !== null &&
        !Array.isArray(record.record)
      );
    } catch {
      return false;
    }
  });
}

/** Parses Google adapter calls and enforces exact file, endpoint, and HTTP-method operations. */
function scanGoogleSource(
  relativePath: string,
  text: string,
  fileIdentifier: string,
): ReleaseViolation[] {
  const violations: ReleaseViolation[] = [];
  const sourceFile = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const staticValues = new Map<string, string>();
  const ambiguousValues = new Set<string>();
  const forbiddenAliases = new Set<string>();
  const eventObjectAliases = new Set<string>();

  sourceFile.forEachChild(function collectStaticValues(node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const value = canonicalExpression(
        node.initializer,
        staticValues,
        sourceFile,
      );
      if (value !== undefined) {
        const existing = staticValues.get(node.name.text);
        if (existing !== undefined && existing !== value) {
          staticValues.delete(node.name.text);
          ambiguousValues.add(node.name.text);
        } else if (!ambiguousValues.has(node.name.text)) {
          staticValues.set(node.name.text, value);
        }
      }
      if (
        ts.isPropertyAccessExpression(node.initializer) &&
        ["insert", "update", "patch", "move", "delete"].includes(
          node.initializer.name.text,
        ) &&
        ((ts.isPropertyAccessExpression(node.initializer.expression) &&
          node.initializer.expression.name.text === "events") ||
          (ts.isIdentifier(node.initializer.expression) &&
            eventObjectAliases.has(node.initializer.expression.text)))
      ) {
        forbiddenAliases.add(node.name.text);
      }
      if (
        ts.isPropertyAccessExpression(node.initializer) &&
        node.initializer.name.text === "events"
      ) {
        eventObjectAliases.add(node.name.text);
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      ((ts.isPropertyAccessExpression(node.initializer) &&
        node.initializer.name.text === "events") ||
        (ts.isIdentifier(node.initializer) &&
          eventObjectAliases.has(node.initializer.text)))
    ) {
      for (const element of node.name.elements) {
        const providerName = element.propertyName?.getText(sourceFile) ??
          element.name.getText(sourceFile);
        if (
          ["insert", "update", "patch", "move", "delete"].includes(
            providerName,
          ) &&
          ts.isIdentifier(element.name)
        ) {
          forbiddenAliases.add(element.name.text);
        }
      }
    }
    node.forEachChild(collectStaticValues);
  });

  const allowedOperations = APPROVED_GOOGLE_OPERATIONS.get(relativePath);
  const providerMarkerPresent =
    /(?:googleapis\.com|GOOGLE_CALENDAR_BASE_URL|calendar\s*\.\s*events)/u.test(
      text,
    );

  sourceFile.forEachChild(function inspectCalls(node): void {
    if (ts.isCallExpression(node)) {
      let forbiddenSdkCall = false;
      if (ts.isPropertyAccessExpression(node.expression)) {
        const methodName = node.expression.name.text;
        forbiddenSdkCall =
          ["insert", "update", "patch", "move", "delete"].includes(
            methodName,
          ) &&
          ((ts.isPropertyAccessExpression(node.expression.expression) &&
            node.expression.expression.name.text === "events") ||
            (ts.isIdentifier(node.expression.expression) &&
              eventObjectAliases.has(node.expression.expression.text)));
      } else if (
        ts.isIdentifier(node.expression) &&
        forbiddenAliases.has(node.expression.text)
      ) {
        forbiddenSdkCall = true;
      }
      if (forbiddenSdkCall) {
        violations.push({
          category: "google-event-write",
          file: fileIdentifier,
          reason: "Google Calendar event mutation call is present",
        });
      }

      const calleeName = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : undefined;
      if (
        calleeName === "fetch" ||
        calleeName === "fetcher" ||
        calleeName === "request"
      ) {
        let enclosingName: string | undefined;
        let parent: ts.Node | undefined = node.parent;
        while (parent) {
          if (
            (ts.isMethodDeclaration(parent) ||
              ts.isFunctionDeclaration(parent)) &&
            parent.name
          ) {
            enclosingName = parent.name.getText(sourceFile);
            break;
          }
          parent = parent.parent;
        }
        const isReviewedTransportForwarder =
          relativePath ===
            "src/integrations/google-calendar/calendar-client.ts" &&
          calleeName === "fetcher" &&
          enclosingName === "request" &&
          ts.isIdentifier(node.arguments[0]) &&
          node.arguments[0].text === "url" &&
          ts.isObjectLiteralExpression(node.arguments[1]) &&
          node.arguments[1].properties.some(
            (property) =>
              ts.isSpreadAssignment(property) &&
              ts.isIdentifier(property.expression) &&
              property.expression.text === "init",
          );
        if (!isReviewedTransportForwarder) {
          const endpoint = canonicalExpression(
            node.arguments[0],
            staticValues,
            sourceFile,
          );
          const method = readHttpMethod(
            node.arguments[1],
            staticValues,
            sourceFile,
          );
          const approved =
            endpoint !== undefined &&
            method !== undefined &&
            allowedOperations?.some(
              (operation) =>
                operation.method === method &&
                operation.endpoint.test(endpoint),
            ) === true;
          if (
            !approved &&
            (allowedOperations !== undefined ||
              providerMarkerPresent ||
              endpoint?.includes("googleapis.com") === true ||
              endpoint?.includes("GOOGLE_CALENDAR_BASE_URL") === true)
          ) {
            violations.push({
              category: "google-event-write",
              file: fileIdentifier,
              reason:
                "Google call is unresolved or outside the exact Phase B operation allowlist",
            });
          }
        }
      }
    }
    node.forEachChild(inspectCalls);
  });

  if (providerMarkerPresent && !allowedOperations) {
    violations.push({
      category: "google-event-write",
      file: fileIdentifier,
      reason: "Google call exists outside the explicit Phase B adapter allowlist",
    });
  }
  return violations;
}

/** Parses Hono route registrations, bounded path constants, `.on`, and mounted event routers. */
function scanRouteSource(
  relativePath: string,
  text: string,
  fileIdentifier: string,
): ReleaseViolation[] {
  const violations: ReleaseViolation[] = [];
  const sourceFile = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const staticValues = new Map<string, string>();
  const honoReceivers = new Set<string>();
  const honoBasePaths = new Map<string, string>();

  sourceFile.forEachChild(function collectRouteFacts(node): void {
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      if (node.type?.getText(sourceFile).includes("Hono")) {
        honoReceivers.add(node.name.text);
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const identifier = node.name.text;
      const basePathCall =
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        ts.isPropertyAccessExpression(node.initializer.expression) &&
        node.initializer.expression.name.text === "basePath"
          ? node.initializer
          : undefined;
      const basePathReceiver = basePathCall &&
        ts.isPropertyAccessExpression(basePathCall.expression)
        ? basePathCall.expression.expression
        : undefined;
      const initializesHonoBasePath =
        basePathReceiver !== undefined &&
        ((ts.isNewExpression(basePathReceiver) &&
          ts.isIdentifier(basePathReceiver.expression) &&
          basePathReceiver.expression.text === "Hono") ||
          (ts.isIdentifier(basePathReceiver) &&
            honoReceivers.has(basePathReceiver.text)));
      if (
        node.type?.getText(sourceFile).includes("Hono") ||
        (node.initializer &&
          ts.isNewExpression(node.initializer) &&
          ts.isIdentifier(node.initializer.expression) &&
          node.initializer.expression.text === "Hono") ||
        (node.initializer &&
          ts.isIdentifier(node.initializer) &&
          honoReceivers.has(node.initializer.text)) ||
        initializesHonoBasePath
      ) {
        honoReceivers.add(identifier);
      }
      if (basePathCall && initializesHonoBasePath) {
        const basePath = canonicalExpression(
          basePathCall.arguments[0],
          staticValues,
          sourceFile,
        );
        if (basePath !== undefined) honoBasePaths.set(identifier, basePath);
      } else if (
        node.initializer &&
        ts.isIdentifier(node.initializer) &&
        honoBasePaths.has(node.initializer.text)
      ) {
        honoBasePaths.set(
          identifier,
          honoBasePaths.get(node.initializer.text) as string,
        );
      }
      const value = canonicalExpression(
        node.initializer,
        staticValues,
        sourceFile,
      );
      if (value !== undefined) staticValues.set(identifier, value);
    }
    node.forEachChild(collectRouteFacts);
  });

  sourceFile.forEachChild(function inspectRoutes(node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const registration = node.expression.name.text.toLowerCase();
      if (
        [
          "get",
          "post",
          "put",
          "patch",
          "delete",
          "all",
          "on",
          "route",
        ].includes(registration)
      ) {
        const receiver = node.expression.expression;
        const receiverIsHono =
          ts.isIdentifier(receiver) && honoReceivers.has(receiver.text);
        const routeArgument =
          registration === "on" ? node.arguments[1] : node.arguments[0];
        const route = canonicalExpression(
          routeArgument,
          staticValues,
          sourceFile,
        );
        const basePath =
          ts.isIdentifier(receiver) ? honoBasePaths.get(receiver.text) : undefined;
        const effectiveRoute =
          route !== undefined && basePath !== undefined
            ? `${basePath.replace(/\/$/u, "")}/${route.replace(/^\//u, "")}`
            : route;
        const routeLooksHttp =
          effectiveRoute?.startsWith("/api/") === true ||
          effectiveRoute?.startsWith("/webhooks/") === true;
        if (receiverIsHono || routeLooksHttp) {
          let methods: string[] | undefined;
          if (registration === "on") {
            const methodArgument = node.arguments[0];
            if (ts.isArrayLiteralExpression(methodArgument)) {
              const resolved = methodArgument.elements.map((element) =>
                canonicalExpression(
                  element as ts.Expression,
                  staticValues,
                  sourceFile,
                )?.toUpperCase(),
              );
              methods = resolved.every(
                (method): method is string => method !== undefined,
              )
                ? resolved
                : undefined;
            } else {
              const method = canonicalExpression(
                methodArgument,
                staticValues,
                sourceFile,
              )?.toUpperCase();
              methods = method ? [method] : undefined;
            }
          } else if (registration === "route") {
            methods = ["MOUNT"];
          } else if (registration === "all") {
            methods = ["ALL"];
          } else {
            methods = [registration.toUpperCase()];
          }

          if (effectiveRoute === undefined || methods === undefined) {
            if (receiverIsHono && registration !== "get") {
              violations.push({
                category: "event-write-route",
                file: fileIdentifier,
                reason: "mutating Hono route declaration is not statically resolvable",
              });
            }
          } else if (effectiveRoute.includes("/events")) {
            const allowedCategoryCorrection =
              methods.length === 1 &&
              methods[0] === "PATCH" &&
              effectiveRoute === "/api/calendar/events/:id/category";
            const readOnly = methods.every((method) => method === "GET");
            if (!readOnly && !allowedCategoryCorrection) {
              violations.push({
                category: "event-write-route",
                file: fileIdentifier,
                reason: "Phase B event-write route is present",
              });
            }
          }
        }
      }
    }
    node.forEachChild(inspectRoutes);
  });
  return violations;
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
  const forbiddenFileFragments = [
    ...protectedVariants,
    ...CLIENT_FORBIDDEN_BINDING_NAMES,
  ];
  const scanTargets = [
    {
      relativePath: "dist/client",
      kind: "directory" as const,
      protectedValues: true,
      secretBindings: true,
      sourceKind: undefined,
      evidenceSurface: undefined,
    },
    ...EVIDENCE_TARGETS.map((target) => ({
      relativePath: target.relativePath,
      kind: "file" as const,
      protectedValues: true,
      secretBindings: false,
      sourceKind: undefined,
      evidenceSurface: target.surface,
    })),
    {
      relativePath: "src/integrations/google",
      kind: "directory" as const,
      protectedValues: false,
      secretBindings: false,
      sourceKind: "google" as const,
      evidenceSurface: undefined,
    },
    {
      relativePath: "src/integrations/google-calendar",
      kind: "directory" as const,
      protectedValues: false,
      secretBindings: false,
      sourceKind: "google" as const,
      evidenceSurface: undefined,
    },
    {
      relativePath: "src",
      kind: "directory" as const,
      protectedValues: false,
      secretBindings: false,
      sourceKind: "routes" as const,
      evidenceSurface: undefined,
    },
  ];
  const sourceFiles = new Map<
    string,
    {
      readonly relativePath: string;
      readonly sourceKind: SourceKind;
      readonly text: string;
      readonly fileIdentifier: string;
    }
  >();

  for (const target of scanTargets) {
    const absoluteRoot = resolve(projectRoot, target.relativePath);
    let rootStat;
    try {
      rootStat = await lstat(absoluteRoot);
      if (
        rootStat.isSymbolicLink() ||
        (target.kind === "directory"
          ? !rootStat.isDirectory()
          : !rootStat.isFile())
      ) {
        throw new Error("wrong-evidence-kind");
      }
    } catch {
      violations.push({
        category: "missing-evidence",
        file: safeFileIdentifier(
          projectRoot,
          absoluteRoot,
          forbiddenFileFragments,
        ),
        reason: "required release evidence is absent or unreadable",
      });
      continue;
    }

    const files: string[] = [];
    if (target.kind === "file") {
      files.push(absoluteRoot);
    } else {
      const directories = [absoluteRoot];
      while (directories.length > 0) {
        const directory = directories.pop();
        if (!directory) break;
        let entries;
        try {
          entries = await readdir(directory, { withFileTypes: true });
        } catch {
          violations.push({
            category: "missing-evidence",
            file: safeFileIdentifier(
              projectRoot,
              directory,
              forbiddenFileFragments,
            ),
            reason: "required release evidence is unreadable",
          });
          continue;
        }
        for (const entry of entries) {
          const path = resolve(directory, entry.name);
          if (entry.isSymbolicLink()) {
            violations.push({
              category: "missing-evidence",
              file: safeFileIdentifier(
                projectRoot,
                path,
                forbiddenFileFragments,
              ),
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
          file: safeFileIdentifier(
            projectRoot,
            absoluteRoot,
            forbiddenFileFragments,
          ),
          reason: "required release evidence contains no files",
        });
      }
    }

    for (const file of files.sort()) {
      const fileIdentifier = safeFileIdentifier(
        projectRoot,
        file,
        forbiddenFileFragments,
      );
      let bytes: Buffer;
      try {
        const fileStat = await lstat(file);
        if (
          fileStat.isSymbolicLink() ||
          !fileStat.isFile() ||
          fileStat.size > 16 * 1024 * 1024
        ) {
          throw new Error("unacceptable-file");
        }
        bytes = await readFile(file);
      } catch {
        violations.push({
          category: "missing-evidence",
          file: fileIdentifier,
          reason: "required release evidence is unreadable or oversized",
        });
        continue;
      }
      const text = bytes.toString("utf8");

      if (
        target.evidenceSurface &&
        !hasValidEvidenceProvenance(text, target.evidenceSurface)
      ) {
        violations.push({
          category: "missing-evidence",
          file: fileIdentifier,
          reason: "named release evidence has invalid provenance",
        });
      }
      if (
        target.protectedValues &&
        [...protectedVariants].some((variant) =>
          bytes.includes(Buffer.from(variant, "utf8")),
        )
      ) {
        violations.push({
          category: "protected-value",
          file: fileIdentifier,
          reason: "protected sentinel encoding is present",
        });
      }
      if (
        target.secretBindings &&
        CLIENT_FORBIDDEN_BINDING_NAMES.some((binding) =>
          text.includes(binding),
        )
      ) {
        violations.push({
          category: "client-secret-binding",
          file: fileIdentifier,
          reason: "server-only binding name is present in a client asset",
        });
      }
      if (target.sourceKind && /\.tsx?$/u.test(fileIdentifier)) {
        sourceFiles.set(`${target.sourceKind}:${fileIdentifier}`, {
          relativePath: relative(projectRoot, file).replaceAll("\\", "/"),
          sourceKind: target.sourceKind,
          text,
          fileIdentifier,
        });
      }
    }
  }

  for (const source of sourceFiles.values()) {
    violations.push(
      ...(source.sourceKind === "google"
        ? scanGoogleSource(
            source.relativePath,
            source.text,
            source.fileIdentifier,
          )
        : scanRouteSource(
            source.relativePath,
            source.text,
            source.fileIdentifier,
          )),
    );
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
    protectedSentinel: PROTECTED_RELEASE_SENTINEL,
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
