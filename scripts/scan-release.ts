/** Scans local Phase B release evidence for protected data and forbidden calendar-write surfaces. */
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import {
  CLIENT_FORBIDDEN_BINDING_NAMES,
  CLIENT_FORBIDDEN_RUNTIME_VALUES,
} from "../src/server/client-binding-boundary";

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
    | "protected-value"
    | "r2-deletion-capability";
  readonly file: string;
  readonly reason: string;
}

export interface ReleaseScanResult {
  readonly violations: readonly ReleaseViolation[];
}

type SourceKind = "google" | "routes";

/** One path proven to own or expose R2 object-deletion capability. */
export interface R2DeletionCapabilityFinding {
  readonly path: string;
  readonly capability:
    | "adapter"
    | "failed_verification_cleanup"
    | "validated_retention"
    | "unexpected";
}

const R2_DELETION_PATH_CAPABILITIES = new Map<
  string,
  Exclude<R2DeletionCapabilityFinding["capability"], "unexpected">
>([
  ["src/data/backup/r2-object-store.ts", "adapter"],
  ["src/jobs/create-daily-backup.ts", "failed_verification_cleanup"],
  ["src/jobs/purge-expired-backups.ts", "validated_retention"],
]);

const R2_PERMANENT_ORCHESTRATOR = "src/jobs/scheduled.ts";

interface R2SourceAnalysis {
  readonly checker: ts.TypeChecker;
  readonly directDeleteCalls: readonly ts.CallExpression[];
  readonly exportedCapabilityNames: ReadonlySet<string>;
  readonly ownsCapability: boolean;
  readonly imports: readonly {
    readonly modulePath: string;
    readonly importedNames: ReadonlySet<string> | undefined;
    readonly reExports: readonly {
      readonly importedName: string;
      readonly exportedName: string;
    }[];
  }[];
  readonly sourceFile: ts.SourceFile;
}

/** Normalizes only repository-relative source-map keys. */
function normalizeRepositoryPath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.replaceAll("\\", "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return segments.join("/");
}

/** Resolves one static relative module specifier without consulting the host filesystem. */
function resolveSourceMapModule(importer: string, specifier: string): string {
  if (!specifier.startsWith(".")) return specifier;
  const directory = normalizeRepositoryPath(importer)
    .split("/")
    .slice(0, -1)
    .join("/");
  const resolved = normalizeRepositoryPath(`${directory}/${specifier}`);
  if (/\.[cm]?jsx$/u.test(resolved)) return resolved.replace(/\.[cm]?jsx$/u, ".tsx");
  if (/\.[cm]?js$/u.test(resolved)) return resolved.replace(/\.[cm]?js$/u, ".ts");
  return /\.[cm]?tsx?$/u.test(resolved) ? resolved : `${resolved}.ts`;
}

/** Returns true only for a statically named member. */
function r2MemberName(expression: ts.Expression): string | undefined {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (
    ts.isElementAccessExpression(expression) &&
    expression.argumentExpression &&
    (ts.isStringLiteral(expression.argumentExpression) ||
      ts.isNoSubstitutionTemplateLiteral(expression.argumentExpression))
  ) {
    return expression.argumentExpression.text;
  }
  return undefined;
}

/** Finds the nearest exported declaration name that owns a capability use. */
function exportedOwnerName(node: ts.Node): string | undefined {
  for (let current: ts.Node | undefined = node; current; current = current.parent) {
    if (
      (ts.isFunctionDeclaration(current) ||
        ts.isClassDeclaration(current) ||
        ts.isVariableStatement(current)) &&
      current.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    ) {
      if (
        current.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
        )
      ) {
        return "default";
      }
      if (ts.isVariableStatement(current)) {
        const declaration = current.declarationList.declarations[0];
        return declaration && ts.isIdentifier(declaration.name)
          ? declaration.name.text
          : undefined;
      }
      return current.name?.text;
    }
  }
  return undefined;
}

interface R2TypeScriptProgram {
  readonly checker: ts.TypeChecker;
  readonly sourceFiles: ReadonlyMap<string, ts.SourceFile>;
}

/** Creates one in-memory program so every identifier can be compared by lexical symbol. */
function createR2TypeScriptProgram(
  sources: ReadonlyMap<string, string>,
): R2TypeScriptProgram {
  const sourceFiles = new Map<string, ts.SourceFile>();
  for (const [rawPath, text] of sources) {
    const path = normalizeRepositoryPath(rawPath);
    if (!/\.[cm]?[jt]sx?$/u.test(path)) continue;
    sourceFiles.set(
      path,
      ts.createSourceFile(
        path,
        text,
        ts.ScriptTarget.Latest,
        true,
        path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      ),
    );
  }
  const options: ts.CompilerOptions = {
    allowJs: false,
    noLib: true,
    noResolve: true,
    target: ts.ScriptTarget.Latest,
  };
  const host = ts.createCompilerHost(options, true);
  host.fileExists = (fileName) =>
    sourceFiles.has(normalizeRepositoryPath(fileName));
  host.getCanonicalFileName = (fileName) => normalizeRepositoryPath(fileName);
  host.getCurrentDirectory = () => "";
  host.getSourceFile = (fileName) =>
    sourceFiles.get(normalizeRepositoryPath(fileName));
  host.readFile = (fileName) =>
    sourceFiles.get(normalizeRepositoryPath(fileName))?.text;
  host.writeFile = () => undefined;
  const program = ts.createProgram({
    rootNames: [...sourceFiles.keys()],
    options,
    host,
  });
  return { checker: program.getTypeChecker(), sourceFiles };
}

/** Returns the declaration identity selected by TypeScript's lexical binder. */
function bindingOf(
  checker: ts.TypeChecker,
  identifier: ts.Identifier,
): ts.Symbol | undefined {
  return checker.getSymbolAtLocation(identifier);
}

/** Unwraps syntax that cannot change a value's declaration identity. */
function unwrapR2Expression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/** Compares one identifier expression to one exact declaration symbol. */
function expressionBindsTo(
  expression: ts.Expression,
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): boolean {
  const unwrapped = unwrapR2Expression(expression);
  return (
    ts.isIdentifier(unwrapped) && bindingOf(checker, unwrapped) === symbol
  );
}

/** Parses TypeScript syntax and follows bounded aliases by declaration identity. */
function analyzeR2TypeScript(
  path: string,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): R2SourceAnalysis {
  const capabilityTypeSymbols = new Set<ts.Symbol>();
  const taintedObjectSymbols = new Set<ts.Symbol>();
  const deleteCallbackSymbols = new Set<ts.Symbol>();
  const imports: {
    modulePath: string;
    importedNames: ReadonlySet<string> | undefined;
    reExports: readonly {
      importedName: string;
      exportedName: string;
    }[];
  }[] = [];
  const capabilityTypeDeclarations: (ts.InterfaceDeclaration | ts.TypeAliasDeclaration)[] = [];

  sourceFile.forEachChild(function collectCapabilityTypes(node): void {
    if (
      (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      node.name &&
      node.getText(sourceFile).includes("delete")
    ) {
      capabilityTypeDeclarations.push(node);
      let declaresDelete = false;
      node.forEachChild(function findDeleteMember(child): void {
        if (
          (ts.isMethodSignature(child) || ts.isPropertySignature(child)) &&
          child.name &&
          (ts.isIdentifier(child.name) || ts.isStringLiteral(child.name)) &&
          child.name.text === "delete"
        ) {
          declaresDelete = true;
        }
        child.forEachChild(findDeleteMember);
      });
      const symbol = bindingOf(checker, node.name);
      if (declaresDelete && symbol) capabilityTypeSymbols.add(symbol);
    } else if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      capabilityTypeDeclarations.push(node);
    }
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.importClause;
      const modulePath = resolveSourceMapModule(path, node.moduleSpecifier.text);
      let importedNames: Set<string> | undefined;
      if (clause) {
        importedNames = new Set<string>();
        if (clause.name) importedNames.add("default");
        if (clause.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings)) {
            importedNames = undefined;
          } else {
            for (const element of clause.namedBindings.elements) {
              const importedName = element.propertyName?.text ?? element.name.text;
              importedNames.add(importedName);
              if (
                modulePath === "src/jobs/create-daily-backup.ts" &&
                importedName === "BackupObjectStore"
              ) {
                const symbol = bindingOf(checker, element.name);
                if (symbol) capabilityTypeSymbols.add(symbol);
              }
            }
          }
        }
      }
      imports.push({
        modulePath,
        importedNames,
        reExports: [],
      });
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const importedNames = node.exportClause && ts.isNamedExports(node.exportClause)
        ? new Set(
            node.exportClause.elements.map(
              (element) => element.propertyName?.text ?? element.name.text,
            ),
          )
        : undefined;
      const reExports = node.exportClause && ts.isNamedExports(node.exportClause)
        ? node.exportClause.elements.map((element) => ({
            importedName: element.propertyName?.text ?? element.name.text,
            exportedName: element.name.text,
          }))
        : [];
      imports.push({
        modulePath: resolveSourceMapModule(path, node.moduleSpecifier.text),
        importedNames,
        reExports,
      });
    }
    node.forEachChild(collectCapabilityTypes);
  });

  let typeChanged = true;
  while (typeChanged) {
    typeChanged = false;
    for (const declaration of capabilityTypeDeclarations) {
      const declarationSymbol = bindingOf(checker, declaration.name);
      if (!declarationSymbol || capabilityTypeSymbols.has(declarationSymbol)) {
        continue;
      }
      let carriesCapability = false;
      declaration.forEachChild(function inspectReferencedType(node): void {
        if (ts.isIdentifier(node)) {
          const referenced = bindingOf(checker, node);
          if (
            node.text === "R2Bucket" ||
            (referenced !== undefined && capabilityTypeSymbols.has(referenced))
          ) {
            carriesCapability = true;
          }
        }
        node.forEachChild(inspectReferencedType);
      });
      if (carriesCapability) {
        capabilityTypeSymbols.add(declarationSymbol);
        typeChanged = true;
      }
    }
  }

  /** Proves that a declared type transitively carries the deletion-capable port. */
  const typeHasCapability = (type: ts.TypeNode | undefined): boolean => {
    if (!type) return false;
    let carriesCapability = false;
    type.forEachChild(function inspectType(node): void {
      if (ts.isIdentifier(node)) {
        const symbol = bindingOf(checker, node);
        if (
          node.text === "R2Bucket" ||
          (symbol !== undefined && capabilityTypeSymbols.has(symbol))
        ) {
          carriesCapability = true;
        }
      }
      node.forEachChild(inspectType);
    });
    return carriesCapability;
  };

  sourceFile.forEachChild(function collectTypedObjects(node): void {
    if (
      (ts.isParameter(node) ||
        ts.isVariableDeclaration(node) ||
        ts.isPropertyDeclaration(node)) &&
      ts.isIdentifier(node.name) &&
      typeHasCapability(node.type)
    ) {
      const symbol = bindingOf(checker, node.name);
      if (symbol) taintedObjectSymbols.add(symbol);
    }
    node.forEachChild(collectTypedObjects);
  });

  /** Follows only bounded expressions already proven to hold the deletion-capable port. */
  const expressionIsTaintedObject = (expression: ts.Expression): boolean => {
    const unwrapped = unwrapR2Expression(expression);
    if (ts.isIdentifier(unwrapped)) {
      const symbol = bindingOf(checker, unwrapped);
      return symbol !== undefined && taintedObjectSymbols.has(symbol);
    }
    if (ts.isPropertyAccessExpression(unwrapped)) {
      return expressionIsTaintedObject(unwrapped.expression);
    }
    return false;
  };

  let changed = true;
  while (changed) {
    changed = false;
    sourceFile.forEachChild(function collectAliases(node): void {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (
          ts.isIdentifier(node.name) &&
          expressionIsTaintedObject(node.initializer) &&
          bindingOf(checker, node.name) !== undefined
        ) {
          const symbol = bindingOf(checker, node.name);
          if (symbol && !taintedObjectSymbols.has(symbol)) {
            taintedObjectSymbols.add(symbol);
            changed = true;
          }
        }
        if (
          ts.isObjectBindingPattern(node.name) &&
          expressionIsTaintedObject(node.initializer)
        ) {
          for (const element of node.name.elements) {
            if (
              (element.propertyName?.getText(sourceFile) ??
                element.name.getText(sourceFile)) === "delete" &&
              ts.isIdentifier(element.name)
            ) {
              const symbol = bindingOf(checker, element.name);
              if (symbol && !deleteCallbackSymbols.has(symbol)) {
                deleteCallbackSymbols.add(symbol);
                changed = true;
              }
            }
          }
        }
        if (ts.isIdentifier(node.name)) {
          const initializer = node.initializer;
          const isDeleteMember =
            (ts.isPropertyAccessExpression(initializer) ||
              ts.isElementAccessExpression(initializer)) &&
            r2MemberName(initializer) === "delete" &&
            expressionIsTaintedObject(initializer.expression);
          const isBoundDelete =
            ts.isCallExpression(initializer) &&
            (ts.isPropertyAccessExpression(initializer.expression) ||
              ts.isElementAccessExpression(initializer.expression)) &&
            r2MemberName(initializer.expression) === "bind" &&
            (ts.isPropertyAccessExpression(initializer.expression.expression) ||
              ts.isElementAccessExpression(initializer.expression.expression)) &&
            r2MemberName(initializer.expression.expression) === "delete" &&
            expressionIsTaintedObject(
              initializer.expression.expression.expression,
            );
          const isCallbackAlias =
            ts.isIdentifier(initializer) &&
            (() => {
              const symbol = bindingOf(checker, initializer);
              return symbol !== undefined && deleteCallbackSymbols.has(symbol);
            })();
          if (isDeleteMember || isBoundDelete || isCallbackAlias) {
            const symbol = bindingOf(checker, node.name);
            if (symbol && !deleteCallbackSymbols.has(symbol)) {
              deleteCallbackSymbols.add(symbol);
              changed = true;
            }
          }
        }
      }
      node.forEachChild(collectAliases);
    });
  }

  const directDeleteCalls: ts.CallExpression[] = [];
  const exportedCapabilityNames = new Set<string>();
  let ownsCapability = deleteCallbackSymbols.size > 0;
  if (ownsCapability) {
    sourceFile.forEachChild(function collectCallbackOwners(node): void {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        (() => {
          const symbol = bindingOf(checker, node.name);
          return symbol !== undefined && deleteCallbackSymbols.has(symbol);
        })()
      ) {
        const owner = exportedOwnerName(node);
        if (owner) exportedCapabilityNames.add(owner);
      }
      node.forEachChild(collectCallbackOwners);
    });
  }
  sourceFile.forEachChild(function inspectCapabilityUses(node): void {
    if (
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      r2MemberName(node) === "delete" &&
      expressionIsTaintedObject(node.expression)
    ) {
      ownsCapability = true;
      const owner = exportedOwnerName(node);
      if (owner) exportedCapabilityNames.add(owner);
    }
    if (ts.isCallExpression(node)) {
      const directMemberCall =
        (ts.isPropertyAccessExpression(node.expression) ||
          ts.isElementAccessExpression(node.expression)) &&
        r2MemberName(node.expression) === "delete" &&
        expressionIsTaintedObject(node.expression.expression);
      const callbackCall =
        ts.isIdentifier(node.expression) &&
        (() => {
          const symbol = bindingOf(checker, node.expression);
          return symbol !== undefined && deleteCallbackSymbols.has(symbol);
        })();
      if (directMemberCall || callbackCall) {
        ownsCapability = true;
        directDeleteCalls.push(node);
        const owner = exportedOwnerName(node);
        if (owner) exportedCapabilityNames.add(owner);
      }
    }
    node.forEachChild(inspectCapabilityUses);
  });

  return {
    checker,
    directDeleteCalls,
    exportedCapabilityNames,
    ownsCapability,
    imports,
    sourceFile,
  };
}

/** Explicitly inspects workflow/config command entries for R2 object deletion. */
function workflowOrConfigHasR2Deletion(path: string, text: string): boolean {
  if (
    !/^(?:\.github\/workflows\/|wrangler[^/]*\.jsonc?$|package\.json$)/u.test(
      path,
    )
  ) {
    return false;
  }
  const entries: {
    readonly text: string;
    readonly workflowRun: boolean;
  }[] = [];
  if (path.startsWith(".github/workflows/")) {
    const lines = text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const run = /^(\s*)(?:-\s*)?(?:run|"run"|'run')\s*:\s*(.*)$/u.exec(
        line,
      );
      if (!run) continue;
      const value = run[2] ?? "";
      const parts: string[] = [];
      if (/^[|>][+-]?$/u.test(value)) {
        const itemPrefix = /^(\s*)-\s*/u.exec(line);
        const keyIndent = itemPrefix
          ? itemPrefix[0].length
          : run[1]?.length ?? 0;
        let contentIndent: number | undefined;
        let next = index + 1;
        for (; next < lines.length; next += 1) {
          const candidate = lines[next] ?? "";
          const candidateIndent = /^\s*/u.exec(candidate)?.[0].length ?? 0;
          if (candidate.trim().length === 0) {
            if (contentIndent !== undefined) parts.push(candidate);
            continue;
          }
          if (contentIndent === undefined) {
            if (candidateIndent <= keyIndent) break;
            contentIndent = candidateIndent;
          } else if (candidateIndent < contentIndent) {
            break;
          }
          parts.push(candidate);
        }
        index = next - 1;
      } else {
        parts.push(value);
      }
      entries.push({ text: parts.join(" "), workflowRun: true });
    }
  } else {
    entries.push({ text, workflowRun: false });
  }
  return entries.some((entry) => {
    const words = new Set(
      entry.text
        .toLowerCase()
        .split(/[^a-z0-9]+/u)
        .filter((word) => word.length > 0),
    );
    const mentionsR2 =
      words.has("r2") ||
      words.has("r2bucket") ||
      words.has("backup") ||
      words.has("backups");
    const requestsDeletion =
      words.has("delete") ||
      words.has("deletion") ||
      words.has("remove") ||
      words.has("cleanup") ||
      words.has("purge") ||
      words.has("destroy");
    const isOperational = entry.workflowRun ||
      words.has("run") ||
      words.has("command") ||
      words.has("operation") ||
      words.has("script") ||
      words.has("module") ||
      words.has("wrangler");
    return mentionsR2 && requestsDeletion && isOperational;
  });
}

const ASSIGNMENT_OPERATOR_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

/** Checks one declaration for an exact TypeScript modifier. */
function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) &&
    ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) === true;
}

/** Returns one uniquely named top-level function declaration. */
function singleTopLevelFunction(
  sourceFile: ts.SourceFile,
  name: string,
): ts.FunctionDeclaration | undefined {
  const matches = sourceFile.statements.filter(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/** Returns one uniquely named top-level variable declaration. */
function singleTopLevelVariable(
  sourceFile: ts.SourceFile,
  name: string,
): ts.VariableDeclaration | undefined {
  const matches: ts.VariableDeclaration[] = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        matches.push(declaration);
      }
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
}

/** Returns one uniquely named variable declared directly in a block. */
function directVariable(
  block: ts.Block,
  name: string,
): ts.VariableDeclaration | undefined {
  const matches: ts.VariableDeclaration[] = [];
  for (const statement of block.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        matches.push(declaration);
      }
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
}

/** Proves a variable belongs to a const declaration list. */
function declarationIsConst(declaration: ts.VariableDeclaration): boolean {
  return ts.isVariableDeclarationList(declaration.parent) &&
    (declaration.parent.flags & ts.NodeFlags.Const) !== 0;
}

/** Checks one syntax node's source interval is inside another. */
function nodeIsWithin(node: ts.Node, container: ts.Node): boolean {
  return node.pos >= container.pos && node.end <= container.end;
}

/** Finds the nearest ancestor matching a bounded syntax predicate. */
function nearestAncestor<T extends ts.Node>(
  node: ts.Node,
  predicate: (candidate: ts.Node) => candidate is T,
): T | undefined {
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    if (predicate(current)) return current;
  }
  return undefined;
}

/** Proves a property or nullish chain is rooted at one declaration. */
function expressionIsRootedAt(
  expression: ts.Expression,
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): boolean {
  const unwrapped = unwrapR2Expression(expression);
  if (expressionBindsTo(unwrapped, symbol, checker)) return true;
  if (
    ts.isPropertyAccessExpression(unwrapped) ||
    ts.isElementAccessExpression(unwrapped)
  ) {
    return expressionIsRootedAt(unwrapped.expression, symbol, checker);
  }
  if (
    ts.isBinaryExpression(unwrapped) &&
    unwrapped.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
  ) {
    return expressionIsRootedAt(unwrapped.left, symbol, checker) &&
      expressionIsRootedAt(unwrapped.right, symbol, checker);
  }
  return false;
}

/** Returns a direct statically named member call or rejects indirection. */
function directMemberCall(
  call: ts.CallExpression,
  memberName: string,
): (ts.PropertyAccessExpression | ts.ElementAccessExpression) | undefined {
  const expression = unwrapR2Expression(call.expression);
  return (
    (ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)) &&
      r2MemberName(expression) === memberName
      ? expression
      : undefined
  );
}

/** Collects direct writes to one exact binding before a source position. */
function bindingWritesBefore(
  root: ts.Node,
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  before: number,
): readonly ts.Node[] {
  const writes: ts.Node[] = [];
  root.forEachChild(function inspect(node): void {
    if (node.pos >= before) return;
    if (
      ts.isBinaryExpression(node) &&
      ASSIGNMENT_OPERATOR_KINDS.has(node.operatorToken.kind) &&
      expressionBindsTo(node.left, symbol, checker)
    ) {
      writes.push(node);
    } else if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      expressionBindsTo(node.operand, symbol, checker)
    ) {
      writes.push(node);
    }
    node.forEachChild(inspect);
  });
  return writes;
}

/** Proves the exact created-versus-existing status conditional. */
function conditionalUsesCreationBinding(
  expression: ts.Expression,
  created: ts.Symbol,
  checker: ts.TypeChecker,
): boolean {
  const unwrapped = unwrapR2Expression(expression);
  return ts.isConditionalExpression(unwrapped) &&
    expressionBindsTo(unwrapped.condition, created, checker) &&
    ts.isStringLiteral(unwrapped.whenTrue) &&
    unwrapped.whenTrue.text === "created" &&
    ts.isStringLiteral(unwrapped.whenFalse) &&
    unwrapped.whenFalse.text === "existing";
}

/** Validates the shared adapter's exact bucket/key deletion binding. */
function validateR2Adapter(analysis: R2SourceAnalysis): boolean {
  const { checker, directDeleteCalls: calls, sourceFile } = analysis;
  if (calls.length !== 1) return false;
  const owner = singleTopLevelFunction(sourceFile, "createR2BackupObjectStore");
  if (
    !owner?.body ||
    !hasModifier(owner, ts.SyntaxKind.ExportKeyword) ||
    owner.parameters.length !== 1 ||
    !ts.isIdentifier(owner.parameters[0]?.name)
  ) {
    return false;
  }
  const bucket = bindingOf(checker, owner.parameters[0].name);
  const call = calls[0];
  const member = directMemberCall(call, "delete");
  const method = nearestAncestor(call, ts.isMethodDeclaration);
  if (
    !bucket ||
    !member ||
    !expressionBindsTo(member.expression, bucket, checker) ||
    !method ||
    !method.name ||
    !(
      (ts.isIdentifier(method.name) || ts.isStringLiteral(method.name)) &&
      method.name.text === "delete"
    ) ||
    method.parameters.length !== 1 ||
    !ts.isIdentifier(method.parameters[0]?.name) ||
    !nodeIsWithin(method, owner.body)
  ) {
    return false;
  }
  const key = bindingOf(checker, method.parameters[0].name);
  return key !== undefined &&
    call.arguments.length === 1 &&
    expressionBindsTo(call.arguments[0], key, checker) &&
    bindingWritesBefore(method, key, checker, call.pos).length === 0 &&
    bindingWritesBefore(owner, bucket, checker, call.pos).length === 0;
}

/** Validates the exact daily creation, verification, catch, and cleanup chain. */
function validateSameInvocationCleanup(analysis: R2SourceAnalysis): boolean {
  const { checker, directDeleteCalls: calls, sourceFile } = analysis;
  if (calls.length !== 1) return false;
  const owner = singleTopLevelFunction(sourceFile, "createDailyBackup");
  const utcDate = singleTopLevelFunction(sourceFile, "utcDate");
  const dailyObjectKey = singleTopLevelFunction(sourceFile, "dailyObjectKey");
  const verifyStoredBackup = singleTopLevelFunction(
    sourceFile,
    "verifyStoredBackup",
  );
  if (
    !owner?.body ||
    !utcDate?.name ||
    !dailyObjectKey?.name ||
    !verifyStoredBackup?.name ||
    !hasModifier(owner, ts.SyntaxKind.ExportKeyword) ||
    !ts.isIdentifier(owner.parameters[0]?.name) ||
    !ts.isIdentifier(owner.parameters[1]?.name)
  ) {
    return false;
  }
  const now = bindingOf(checker, owner.parameters[0].name);
  const dependencies = bindingOf(checker, owner.parameters[1].name);
  const utcDateSymbol = bindingOf(checker, utcDate.name);
  const dailyObjectKeySymbol = bindingOf(checker, dailyObjectKey.name);
  const verifyStoredBackupSymbol = bindingOf(checker, verifyStoredBackup.name);
  const createdDateDeclaration = directVariable(owner.body, "createdDate");
  const objectKeyDeclaration = directVariable(owner.body, "objectKey");
  const createdDeclaration = directVariable(owner.body, "created");
  if (
    !now ||
    !dependencies ||
    !utcDateSymbol ||
    !dailyObjectKeySymbol ||
    !verifyStoredBackupSymbol ||
    !createdDateDeclaration ||
    !objectKeyDeclaration ||
    !createdDeclaration ||
    !declarationIsConst(createdDateDeclaration) ||
    !declarationIsConst(objectKeyDeclaration) ||
    declarationIsConst(createdDeclaration) ||
    createdDeclaration.initializer !== undefined ||
    !ts.isIdentifier(createdDateDeclaration.name) ||
    !ts.isIdentifier(objectKeyDeclaration.name) ||
    !ts.isIdentifier(createdDeclaration.name)
  ) {
    return false;
  }
  const createdDate = bindingOf(checker, createdDateDeclaration.name);
  const objectKey = bindingOf(checker, objectKeyDeclaration.name);
  const created = bindingOf(checker, createdDeclaration.name);
  const createdDateCall = createdDateDeclaration.initializer;
  const objectKeyAwait = objectKeyDeclaration.initializer;
  if (
    !createdDate ||
    !objectKey ||
    !created ||
    !createdDateCall ||
    !ts.isCallExpression(createdDateCall) ||
    !expressionBindsTo(createdDateCall.expression, utcDateSymbol, checker) ||
    createdDateCall.arguments.length !== 1 ||
    !expressionBindsTo(createdDateCall.arguments[0], now, checker) ||
    !objectKeyAwait ||
    !ts.isAwaitExpression(objectKeyAwait) ||
    !ts.isCallExpression(objectKeyAwait.expression) ||
    !expressionBindsTo(
      objectKeyAwait.expression.expression,
      dailyObjectKeySymbol,
      checker,
    ) ||
    objectKeyAwait.expression.arguments.length !== 1 ||
    !expressionBindsTo(
      objectKeyAwait.expression.arguments[0],
      createdDate,
      checker,
    )
  ) {
    return false;
  }

  const createdWrites = bindingWritesBefore(
    owner.body,
    created,
    checker,
    calls[0].pos,
  );
  if (createdWrites.length !== 1 || !ts.isBinaryExpression(createdWrites[0])) {
    return false;
  }
  const createdAssignment = createdWrites[0];
  const createdSource = unwrapR2Expression(createdAssignment.right);
  if (!ts.isAwaitExpression(createdSource)) return false;
  const putCall = unwrapR2Expression(createdSource.expression);
  if (!ts.isCallExpression(putCall)) return false;
  const putMember = directMemberCall(putCall, "putIfAbsent");
  if (
    !putMember ||
    !expressionIsRootedAt(putMember.expression, dependencies, checker) ||
    putCall.arguments.length === 0 ||
    !expressionBindsTo(putCall.arguments[0], objectKey, checker)
  ) {
    return false;
  }

  const call = calls[0];
  const deleteMember = directMemberCall(call, "delete");
  const catchClause = nearestAncestor(call, ts.isCatchClause);
  const guard = nearestAncestor(call, ts.isIfStatement);
  if (
    !deleteMember ||
    !expressionIsRootedAt(deleteMember.expression, dependencies, checker) ||
    call.arguments.length !== 1 ||
    !expressionBindsTo(call.arguments[0], objectKey, checker) ||
    !catchClause ||
    !guard ||
    !nodeIsWithin(call, guard.thenStatement) ||
    !expressionBindsTo(guard.expression, created, checker)
  ) {
    return false;
  }
  const verificationTry = catchClause.parent;
  if (
    !ts.isTryStatement(verificationTry) ||
    verificationTry.catchClause !== catchClause ||
    createdAssignment.end >= verificationTry.pos ||
    bindingWritesBefore(owner.body, objectKey, checker, call.pos).length !== 0 ||
    bindingWritesBefore(owner.body, createdDate, checker, call.pos).length !== 0
  ) {
    return false;
  }

  const verificationStatements = verificationTry.tryBlock.statements;
  const verificationReturn = verificationStatements.length === 1 &&
      ts.isReturnStatement(verificationStatements[0])
    ? verificationStatements[0]
    : undefined;
  const verificationAwait = verificationReturn?.expression;
  if (
    !verificationAwait ||
    !ts.isAwaitExpression(verificationAwait) ||
    !ts.isCallExpression(verificationAwait.expression)
  ) {
    return false;
  }
  const verificationCall = verificationAwait.expression;
  const storeArgument = verificationCall.arguments[0] &&
    unwrapR2Expression(verificationCall.arguments[0]);
  const backupKeyArgument = verificationCall.arguments[3] &&
    unwrapR2Expression(verificationCall.arguments[3]);
  const statusArgument = verificationCall.arguments[4];
  if (
    !expressionBindsTo(
      verificationCall.expression,
      verifyStoredBackupSymbol,
      checker,
    ) ||
    verificationCall.questionDotToken !== undefined ||
    verificationCall.arguments.length !== 5 ||
    !storeArgument ||
    !ts.isPropertyAccessExpression(storeArgument) ||
    storeArgument.questionDotToken !== undefined ||
    storeArgument.name.text !== "store" ||
    !expressionBindsTo(storeArgument.expression, dependencies, checker) ||
    !expressionBindsTo(verificationCall.arguments[1], objectKey, checker) ||
    !expressionBindsTo(verificationCall.arguments[2], createdDate, checker) ||
    !backupKeyArgument ||
    !ts.isPropertyAccessExpression(backupKeyArgument) ||
    backupKeyArgument.questionDotToken !== undefined ||
    backupKeyArgument.name.text !== "backupKey" ||
    !expressionBindsTo(backupKeyArgument.expression, dependencies, checker) ||
    !statusArgument ||
    !conditionalUsesCreationBinding(statusArgument, created, checker)
  ) {
    return false;
  }
  return (
    createdDateDeclaration.end < objectKeyDeclaration.pos &&
    objectKeyDeclaration.end < createdAssignment.pos &&
    createdAssignment.end < verificationCall.pos &&
    verificationCall.end < call.pos
  );
}

/** Proves an undefined-date branch directly continues the current loop. */
function undefinedGuardContinuesCurrentLoop(
  statement: ts.Statement,
): boolean {
  if (ts.isContinueStatement(statement)) return statement.label === undefined;
  if (!ts.isBlock(statement) || statement.statements.length === 0) return false;
  const last = statement.statements[statement.statements.length - 1];
  return ts.isContinueStatement(last) && last.label === undefined;
}

/** Computes direct aliases of the validated object before deletion. */
function collectObjectAliasesBefore(
  root: ts.Node,
  initial: ts.Symbol,
  checker: ts.TypeChecker,
  before: number,
): ReadonlySet<ts.Symbol> {
  const aliases = new Set<ts.Symbol>([initial]);
  let changed = true;
  while (changed) {
    changed = false;
    root.forEachChild(function inspect(node): void {
      if (node.pos >= before) return;
      let target: ts.Identifier | undefined;
      let value: ts.Expression | undefined;
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      ) {
        target = node.name;
        value = node.initializer;
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left)
      ) {
        target = node.left;
        value = node.right;
      }
      if (target && value) {
        const unwrapped = unwrapR2Expression(value);
        if (ts.isIdentifier(unwrapped)) {
          const source = bindingOf(checker, unwrapped);
          const destination = bindingOf(checker, target);
          if (
            source &&
            destination &&
            aliases.has(source) &&
            !aliases.has(destination)
          ) {
            aliases.add(destination);
            changed = true;
          }
        }
      }
      node.forEachChild(inspect);
    });
  }
  return aliases;
}

/** Checks an expression against a closed set of declaration symbols. */
function expressionBindsToAny(
  expression: ts.Expression,
  symbols: ReadonlySet<ts.Symbol>,
  checker: ts.TypeChecker,
): boolean {
  const unwrapped = unwrapR2Expression(expression);
  if (ts.isIdentifier(unwrapped)) {
    const symbol = bindingOf(checker, unwrapped);
    return symbol !== undefined && symbols.has(symbol);
  }
  return false;
}

/** Detects direct, property, callback, or call-based alias mutation before deletion. */
function objectAliasCanBeMutatedBefore(
  root: ts.Node,
  aliases: ReadonlySet<ts.Symbol>,
  checker: ts.TypeChecker,
  before: number,
  allowedCalls: ReadonlySet<ts.CallExpression>,
): boolean {
  let unsafe = false;
  root.forEachChild(function inspect(node): void {
    if (unsafe || node.pos >= before) return;
    if (
      ts.isBinaryExpression(node) &&
      ASSIGNMENT_OPERATOR_KINDS.has(node.operatorToken.kind)
    ) {
      if (expressionBindsToAny(node.left, aliases, checker)) unsafe = true;
      if (
        (ts.isPropertyAccessExpression(node.left) ||
          ts.isElementAccessExpression(node.left)) &&
        expressionBindsToAny(node.left.expression, aliases, checker)
      ) {
        unsafe = true;
      }
    } else if (
      ts.isPrefixUnaryExpression(node) ||
      ts.isPostfixUnaryExpression(node)
    ) {
      const operand = unwrapR2Expression(node.operand);
      if (
        expressionBindsToAny(operand, aliases, checker) ||
        ((ts.isPropertyAccessExpression(operand) ||
          ts.isElementAccessExpression(operand)) &&
          expressionBindsToAny(operand.expression, aliases, checker))
      ) {
        unsafe = true;
      }
    } else if (ts.isDeleteExpression(node)) {
      const target = unwrapR2Expression(node.expression);
      if (
        (ts.isPropertyAccessExpression(target) ||
          ts.isElementAccessExpression(target)) &&
        expressionBindsToAny(target.expression, aliases, checker)
      ) {
        unsafe = true;
      }
    } else if (ts.isCallExpression(node) && !allowedCalls.has(node)) {
      const callee = unwrapR2Expression(node.expression);
      if (
        ((ts.isPropertyAccessExpression(callee) ||
          ts.isElementAccessExpression(callee)) &&
          expressionBindsToAny(callee.expression, aliases, checker)) ||
        node.arguments.some((argument) =>
          expressionBindsToAny(argument, aliases, checker),
        )
      ) {
        unsafe = true;
      }
    }
    node.forEachChild(inspect);
  });
  return unsafe;
}

/** Validates the exact immutable 30-day retention derivation and delete call. */
function validateRetentionCleanup(analysis: R2SourceAnalysis): boolean {
  const { checker, directDeleteCalls: calls, sourceFile } = analysis;
  if (calls.length !== 1) return false;
  const owner = singleTopLevelFunction(sourceFile, "purgeExpiredBackups");
  const validateDate = singleTopLevelFunction(
    sourceFile,
    "validatedBackupObjectDate",
  );
  const utcDateMilliseconds = singleTopLevelFunction(
    sourceFile,
    "utcDateMilliseconds",
  );
  const retentionDeclaration = singleTopLevelVariable(
    sourceFile,
    "BACKUP_RETENTION_DAYS",
  );
  const dayMillisecondsDeclaration = singleTopLevelVariable(
    sourceFile,
    "DAY_MILLISECONDS",
  );
  if (
    !owner?.body ||
    !validateDate?.name ||
    !utcDateMilliseconds?.name ||
    !retentionDeclaration ||
    !dayMillisecondsDeclaration ||
    !hasModifier(owner, ts.SyntaxKind.ExportKeyword) ||
    !ts.isVariableStatement(retentionDeclaration.parent.parent) ||
    !hasModifier(
      retentionDeclaration.parent.parent,
      ts.SyntaxKind.ExportKeyword,
    ) ||
    !declarationIsConst(retentionDeclaration) ||
    !declarationIsConst(dayMillisecondsDeclaration) ||
    !retentionDeclaration.initializer ||
    !ts.isNumericLiteral(retentionDeclaration.initializer) ||
    Number(retentionDeclaration.initializer.text) !== 30 ||
    !dayMillisecondsDeclaration.initializer ||
    !ts.isNumericLiteral(dayMillisecondsDeclaration.initializer) ||
    Number(dayMillisecondsDeclaration.initializer.text) !== 86_400_000 ||
    !ts.isIdentifier(retentionDeclaration.name) ||
    !ts.isIdentifier(dayMillisecondsDeclaration.name) ||
    !ts.isIdentifier(owner.parameters[0]?.name) ||
    !ts.isIdentifier(owner.parameters[1]?.name)
  ) {
    return false;
  }
  const retentionDays = bindingOf(checker, retentionDeclaration.name);
  const dayMilliseconds = bindingOf(checker, dayMillisecondsDeclaration.name);
  const now = bindingOf(checker, owner.parameters[0].name);
  const dependencies = bindingOf(checker, owner.parameters[1].name);
  const validateDateSymbol = bindingOf(checker, validateDate.name);
  const utcDateMillisecondsSymbol = bindingOf(checker, utcDateMilliseconds.name);
  const todayDeclaration = directVariable(owner.body, "today");
  if (
    !retentionDays ||
    !dayMilliseconds ||
    !now ||
    !dependencies ||
    !validateDateSymbol ||
    !utcDateMillisecondsSymbol ||
    !todayDeclaration ||
    !declarationIsConst(todayDeclaration) ||
    !ts.isIdentifier(todayDeclaration.name) ||
    !todayDeclaration.initializer ||
    !ts.isCallExpression(todayDeclaration.initializer) ||
    !expressionBindsTo(
      todayDeclaration.initializer.expression,
      utcDateMillisecondsSymbol,
      checker,
    ) ||
    todayDeclaration.initializer.arguments.length !== 1 ||
    !expressionBindsTo(todayDeclaration.initializer.arguments[0], now, checker)
  ) {
    return false;
  }
  const today = bindingOf(checker, todayDeclaration.name);
  const call = calls[0];
  const deleteMember = directMemberCall(call, "delete");
  const loop = nearestAncestor(call, ts.isForOfStatement);
  const guard = nearestAncestor(call, ts.isIfStatement);
  if (
    !today ||
    !deleteMember ||
    !expressionIsRootedAt(deleteMember.expression, dependencies, checker) ||
    !loop ||
    !guard ||
    !nodeIsWithin(call, guard.thenStatement) ||
    !ts.isVariableDeclarationList(loop.initializer) ||
    (loop.initializer.flags & ts.NodeFlags.Const) === 0 ||
    loop.initializer.declarations.length !== 1 ||
    !ts.isIdentifier(loop.initializer.declarations[0]?.name) ||
    !ts.isBlock(loop.statement)
  ) {
    return false;
  }
  const object = bindingOf(checker, loop.initializer.declarations[0].name);
  const argument = call.arguments[0] && unwrapR2Expression(call.arguments[0]);
  if (
    !object ||
    !argument ||
    !ts.isPropertyAccessExpression(argument) ||
    argument.name.text !== "key" ||
    !expressionBindsTo(argument.expression, object, checker)
  ) {
    return false;
  }

  const statements = loop.statement.statements;
  const validationDeclaration = directVariable(loop.statement, "createdDate");
  const ageDeclaration = directVariable(loop.statement, "ageDays");
  if (
    !validationDeclaration ||
    !ageDeclaration ||
    !declarationIsConst(validationDeclaration) ||
    !declarationIsConst(ageDeclaration) ||
    !ts.isIdentifier(validationDeclaration.name) ||
    !ts.isIdentifier(ageDeclaration.name) ||
    !validationDeclaration.initializer ||
    !ts.isCallExpression(validationDeclaration.initializer) ||
    !expressionBindsTo(
      validationDeclaration.initializer.expression,
      validateDateSymbol,
      checker,
    ) ||
    validationDeclaration.initializer.arguments.length !== 1 ||
    !expressionBindsTo(
      validationDeclaration.initializer.arguments[0],
      object,
      checker,
    )
  ) {
    return false;
  }
  const createdDate = bindingOf(checker, validationDeclaration.name);
  const ageDays = bindingOf(checker, ageDeclaration.name);
  if (!createdDate || !ageDays) return false;
  const admission = statements.find(
    (statement): statement is ts.IfStatement => {
      if (!ts.isIfStatement(statement)) return false;
      const condition = unwrapR2Expression(statement.expression);
      return ts.isBinaryExpression(condition) &&
        condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
        expressionBindsTo(condition.left, createdDate, checker) &&
        ts.isIdentifier(unwrapR2Expression(condition.right)) &&
        (unwrapR2Expression(condition.right) as ts.Identifier).text ===
          "undefined" &&
        undefinedGuardContinuesCurrentLoop(statement.thenStatement);
    },
  );
  const ageExpression = ageDeclaration.initializer &&
    unwrapR2Expression(ageDeclaration.initializer);
  if (
    !admission ||
    !ageExpression ||
    !ts.isBinaryExpression(ageExpression) ||
    ageExpression.operatorToken.kind !== ts.SyntaxKind.SlashToken ||
    !expressionBindsTo(ageExpression.right, dayMilliseconds, checker)
  ) {
    return false;
  }
  const ageDifference = unwrapR2Expression(ageExpression.left);
  const guardCondition = unwrapR2Expression(guard.expression);
  if (
    !ts.isBinaryExpression(ageDifference) ||
    ageDifference.operatorToken.kind !== ts.SyntaxKind.MinusToken ||
    !expressionBindsTo(ageDifference.left, today, checker) ||
    !expressionBindsTo(ageDifference.right, createdDate, checker) ||
    !ts.isBinaryExpression(guardCondition) ||
    guardCondition.operatorToken.kind !== ts.SyntaxKind.GreaterThanEqualsToken ||
    !expressionBindsTo(guardCondition.left, ageDays, checker) ||
    !expressionBindsTo(guardCondition.right, retentionDays, checker)
  ) {
    return false;
  }
  const validationStatement = validationDeclaration.parent.parent;
  const ageStatement = ageDeclaration.parent.parent;
  const validationIndex = statements.indexOf(validationStatement);
  const admissionIndex = statements.indexOf(admission);
  const ageIndex = statements.indexOf(ageStatement);
  const guardIndex = statements.indexOf(guard);
  if (
    validationIndex < 0 ||
    validationIndex >= admissionIndex ||
    admissionIndex >= ageIndex ||
    ageIndex >= guardIndex ||
    guardIndex < 0 ||
    todayDeclaration.end >= loop.pos
  ) {
    return false;
  }

  const immutableBindings = [
    retentionDays,
    dayMilliseconds,
    today,
    createdDate,
    ageDays,
  ];
  if (
    immutableBindings.some(
      (symbol) =>
        bindingWritesBefore(owner.body!, symbol, checker, call.pos).length > 0,
    )
  ) {
    return false;
  }
  const aliases = collectObjectAliasesBefore(
    loop.statement,
    object,
    checker,
    call.pos,
  );
  const validationCall = validationDeclaration.initializer;
  if (!ts.isCallExpression(validationCall)) return false;
  return !objectAliasCanBeMutatedBefore(
    loop.statement,
    aliases,
    checker,
    call.pos,
    new Set([validationCall, call]),
  );
}

/** Proves approved deletion with exact lexical declarations and fail-closed flow. */
function approvedR2CapabilityIsStructurallyValid(
  path: string,
  analysis: R2SourceAnalysis,
): boolean {
  if (path === "src/data/backup/r2-object-store.ts") {
    return validateR2Adapter(analysis);
  }
  if (path === "src/jobs/create-daily-backup.ts") {
    return validateSameInvocationCleanup(analysis);
  }
  if (path === "src/jobs/purge-expired-backups.ts") {
    return validateRetentionCleanup(analysis);
  }
  return false;
}

/** Returns path-only, closed-category R2 deletion capability findings. */
export function scanR2DeletionCapabilities(
  sources: ReadonlyMap<string, string>,
): readonly R2DeletionCapabilityFinding[] {
  const analyses = new Map<string, R2SourceAnalysis>();
  const capablePaths = new Set<string>();
  const capabilityExports = new Map<string, Set<string>>();
  const typeScriptProgram = createR2TypeScriptProgram(sources);
  for (const [rawPath, text] of sources) {
    const path = normalizeRepositoryPath(rawPath);
    if (/\.[cm]?[jt]sx?$/u.test(path)) {
      const sourceFile = typeScriptProgram.sourceFiles.get(path);
      if (!sourceFile) continue;
      const analysis = analyzeR2TypeScript(
        path,
        sourceFile,
        typeScriptProgram.checker,
      );
      analyses.set(path, analysis);
      capabilityExports.set(path, new Set(analysis.exportedCapabilityNames));
      if (analysis.ownsCapability) capablePaths.add(path);
    } else if (workflowOrConfigHasR2Deletion(path, text)) {
      capablePaths.add(path);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [path, analysis] of analyses) {
      for (const imported of analysis.imports) {
        const provider = analyses.get(imported.modulePath);
        const knownCapabilityExports = new Set(
          imported.modulePath === "src/data/backup/r2-object-store.ts"
            ? ["createR2BackupObjectStore"]
            : imported.modulePath === "src/jobs/create-daily-backup.ts"
              ? ["BackupObjectStore", "createDailyBackup"]
              : imported.modulePath === "src/jobs/purge-expired-backups.ts"
                ? ["purgeExpiredBackups"]
                : [],
        );
        if (
          (!provider || !capablePaths.has(imported.modulePath)) &&
          knownCapabilityExports.size === 0
        ) {
          continue;
        }
        const importsCapability =
          imported.importedNames === undefined ||
          [...imported.importedNames].some((name) =>
            (capabilityExports.get(imported.modulePath)?.has(name) ?? false) ||
            knownCapabilityExports.has(name),
          );
        const isReviewedOrchestration =
          path === R2_PERMANENT_ORCHESTRATOR &&
          R2_DELETION_PATH_CAPABILITIES.has(imported.modulePath);
        if (importsCapability && !isReviewedOrchestration) {
          if (!capablePaths.has(path)) {
            capablePaths.add(path);
            changed = true;
          }
        }
        if (importsCapability && imported.reExports.length > 0) {
          const exports = capabilityExports.get(path) ?? new Set<string>();
          for (const binding of imported.reExports) {
            if (
              binding.importedName === "*" ||
              capabilityExports
                .get(imported.modulePath)
                ?.has(binding.importedName) ||
              knownCapabilityExports.has(binding.importedName)
            ) {
              if (!exports.has(binding.exportedName)) {
                exports.add(binding.exportedName);
                changed = true;
              }
            }
          }
          capabilityExports.set(path, exports);
        }
      }
    }
  }

  return [...capablePaths]
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map((path) => {
      const expected = R2_DELETION_PATH_CAPABILITIES.get(path);
      const analysis = analyses.get(path);
      return {
        path,
        capability:
          expected && analysis && approvedR2CapabilityIsStructurallyValid(path, analysis)
            ? expected
            : "unexpected",
      };
    });
}

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
      {
        method: "GET",
        endpoint:
          /^https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/(?:\$\{[^}]+\}|[^/]+)\/events\/(?:\$\{[^}]+\}|[^/]+)$/u,
      },
    ],
  ],
  [
    "src/integrations/google-calendar/event-write-client.ts",
    [
      {
        method: "GET",
        endpoint:
          /^https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/(?:\$\{[^}]+\}|[^/]+)$/u,
      },
      {
        method: "POST",
        endpoint:
          /^https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/(?:\$\{[^}]+\}|[^/]+)\/events$/u,
      },
      {
        method: "PATCH",
        endpoint:
          /^https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/(?:\$\{[^}]+\}|[^/]+)\/events\/(?:\$\{[^}]+\}|[^/]+)$/u,
      },
      {
        method: "GET",
        endpoint:
          /^https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/(?:\$\{[^}]+\}|[^/]+)\/events$/u,
      },
      {
        method: "GET",
        endpoint:
          /^https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/(?:\$\{[^}]+\}|[^/]+)\/events\/(?:\$\{[^}]+\}|[^/]+)$/u,
      },
      {
        method: "DELETE",
        endpoint:
          /^https:\/\/www\.googleapis\.com\/calendar\/v3\/calendars\/(?:\$\{[^}]+\}|[^/]+)\/events\/(?:\$\{[^}]+\}|[^/]+)$/u,
      },
    ],
  ],
]);

const APPROVED_MUTATING_ROUTES = new Map<
  string,
  readonly { readonly method: string; readonly route: string }[]
>([
  [
    "src/server/api/ai-category-proposal-routes.ts",
    [{ method: "POST", route: "/api/ai/category-proposals" }],
  ],
  [
    "src/server/api/calendar-setup-routes.ts",
    [
      { method: "POST", route: "/api/setup/calendar/discover" },
      { method: "POST", route: "/api/setup/calendar/select" },
      { method: "POST", route: "/api/setup/calendar/confirm-create" },
    ],
  ],
  [
    "src/server/api/diagnostic-routes.ts",
    [
      {
        method: "PATCH",
        route: "/api/calendar/events/:id/category",
      },
    ],
  ],
  [
    "src/server/api/calendar-write-routes.ts",
    [
      { method: "POST", route: "/api/calendar/writes/preview" },
      { method: "POST", route: "/api/calendar/writes/:operationId/confirm" },
      { method: "POST", route: "/api/calendar/writes/:operationId/undo" },
      { method: "POST", route: "/api/calendar/mutations/preview" },
      { method: "POST", route: "/api/calendar/mutations/:operationId/confirm" },
    ],
  ],
  [
    "src/server/api/secretary-routes.ts",
    [
      { method: "POST", route: "/api/secretary/captures" },
      { method: "POST", route: "/api/secretary/tasks" },
      { method: "POST", route: "/api/secretary/tasks/:taskId/:action" },
      { method: "POST", route: "/api/secretary/notes" },
    ],
  ],
  [
    "src/server/auth/oauth-routes.ts",
    [{ method: "POST", route: "/api/auth/logout" }],
  ],
  [
    "src/server/webhooks/google-calendar.ts",
    [{ method: "POST", route: "/webhooks/google/calendar" }],
  ],
  [
    "src/worker.ts",
    [
      { method: "ALL", route: "/api/*" },
      { method: "ALL", route: "*" },
    ],
  ],
]);

const EVIDENCE_TARGETS = [
  {
    relativePath: "dist/release-evidence/application-logs/captured.ndjson",
    surface: "application_logs",
    source: "src/server/logging.ts#logEvent",
  },
  {
    relativePath: "dist/release-evidence/audit/audit.ndjson",
    surface: "audit",
    source: "src/audit/audit-writer.ts#AuditWriter.write",
  },
  {
    relativePath: "dist/release-evidence/queue/queue.ndjson",
    surface: "queue",
    source: "src/jobs/queue-message.ts#parseCalendarSyncMessage",
  },
  {
    relativePath: "dist/release-evidence/database-raw/rows.ndjson",
    surface: "database_raw",
    source: "src/data/repositories/event-repository.ts#prepareStoredEventRow",
  },
  {
    relativePath: "dist/release-evidence/r2-unencrypted/object.json",
    surface: "r2_unencrypted",
    source: "src/crypto/backup-envelope.ts#encryptBackupEnvelope",
  },
] as const;

const EVIDENCE_MANIFEST_PATH = "dist/release-evidence/manifest.json";
const EVIDENCE_GENERATOR = "scripts/capture-release-evidence.ts";
const MAX_EVIDENCE_AGE_MS = 10 * 60 * 1_000;

interface ReleaseEvidenceManifest {
  readonly evidenceVersion: 1;
  readonly generator: typeof EVIDENCE_GENERATOR;
  readonly runId: string;
  readonly capturedAt: string;
  readonly buildDigest: string;
}

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

/** Returns only a statically named dot or bounded bracket member from one expression. */
function staticMemberName(
  expression: ts.Expression,
  staticValues: ReadonlyMap<string, string>,
  sourceFile: ts.SourceFile,
): string | undefined {
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  if (ts.isElementAccessExpression(expression)) {
    return canonicalExpression(
      expression.argumentExpression,
      staticValues,
      sourceFile,
    );
  }
  return undefined;
}

/** Proves that an expression references a Google Calendar events collection. */
function isGoogleEventsExpression(
  expression: ts.Expression,
  eventObjectAliases: ReadonlySet<string>,
  staticValues: ReadonlyMap<string, string>,
  sourceFile: ts.SourceFile,
): boolean {
  return (
    staticMemberName(expression, staticValues, sourceFile) === "events" ||
    (ts.isIdentifier(expression) &&
      eventObjectAliases.has(expression.text))
  );
}

/** Hashes the exact regular-file content of the current client build in path order. */
export async function computeReleaseBuildDigest(
  projectRoot: string,
): Promise<string> {
  const root = resolve(projectRoot, "dist/client");
  const pending = [root];
  const files: string[] = [];
  while (pending.length > 0) {
    const directory = pending.pop();
    if (!directory) break;
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error("Client build cannot contain symbolic links.");
      }
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  if (files.length === 0) {
    throw new Error("Client build contains no files.");
  }
  const digest = createHash("sha256");
  for (const file of files.sort()) {
    const identifier = relative(root, file).replaceAll("\\", "/");
    const bytes = await readFile(file);
    digest.update(`${Buffer.byteLength(identifier, "utf8")}:`);
    digest.update(identifier, "utf8");
    digest.update(`${bytes.byteLength}:`);
    digest.update(bytes);
  }
  return digest.digest("hex");
}

/** Accepts only a fresh capture manifest bound to the current built client. */
function parseEvidenceManifest(
  text: string,
  currentBuildDigest: string,
  nowMs: number,
): ReleaseEvidenceManifest | undefined {
  try {
    const value = JSON.parse(text) as unknown;
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value)
    ) {
      return undefined;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort().join(",");
    const capturedAt =
      typeof record.capturedAt === "string"
        ? Date.parse(record.capturedAt)
        : Number.NaN;
    if (
      keys !==
        "buildDigest,capturedAt,evidenceVersion,generator,runId" ||
      record.evidenceVersion !== 1 ||
      record.generator !== EVIDENCE_GENERATOR ||
      typeof record.runId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
        record.runId,
      ) ||
      typeof record.capturedAt !== "string" ||
      new Date(record.capturedAt).toISOString() !== record.capturedAt ||
      !Number.isFinite(capturedAt) ||
      capturedAt > nowMs + 60_000 ||
      nowMs - capturedAt > MAX_EVIDENCE_AGE_MS ||
      record.buildDigest !== currentBuildDigest
    ) {
      return undefined;
    }
    return {
      evidenceVersion: 1,
      generator: EVIDENCE_GENERATOR,
      runId: record.runId,
      capturedAt: record.capturedAt,
      buildDigest: currentBuildDigest,
    };
  } catch {
    return undefined;
  }
}

/** Validates a generated record against the fresh build-bound capture manifest. */
function hasValidEvidenceProvenance(
  text: string,
  expectedSurface: string,
  expectedSource: string,
  manifest: ReleaseEvidenceManifest | undefined,
): boolean {
  if (!manifest) return false;
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
      return (
        record.evidenceVersion === 1 &&
        record.surface === expectedSurface &&
        capturedAt === manifest.capturedAt &&
        record.buildDigest === manifest.buildDigest &&
        provenanceRecord?.generator === manifest.generator &&
        provenanceRecord.runId === manifest.runId &&
        provenanceRecord.source === expectedSource &&
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
  const transportAliases = new Set<string>(["fetch"]);
  const transportProperties = new Set<string>();

  sourceFile.forEachChild(function collectStaticValues(node): void {
    if (
      ts.isParameter(node) &&
      ts.isIdentifier(node.name) &&
      node.type?.getText(sourceFile).replaceAll(/\s+/gu, "") ===
        "typeoffetch"
    ) {
      transportAliases.add(node.name.text);
      if (
        ts.isConstructorDeclaration(node.parent) &&
        node.modifiers !== undefined
      ) {
        transportProperties.add(node.name.text);
      }
    }
    if (
      ts.isPropertyDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      (node.type?.getText(sourceFile).replaceAll(/\s+/gu, "") ===
        "typeoffetch" ||
        (node.initializer !== undefined &&
          ts.isIdentifier(node.initializer) &&
          transportAliases.has(node.initializer.text)) ||
        (node.initializer !== undefined &&
          ts.isCallExpression(node.initializer) &&
          ts.isPropertyAccessExpression(node.initializer.expression) &&
          node.initializer.expression.name.text === "bind" &&
          ts.isIdentifier(node.initializer.expression.expression) &&
          transportAliases.has(
            node.initializer.expression.expression.text,
          )))
    ) {
      transportProperties.add(node.name.text);
    }
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
        (ts.isPropertyAccessExpression(node.initializer) ||
          ts.isElementAccessExpression(node.initializer)) &&
        ["insert", "update", "patch", "move", "delete"].includes(
          staticMemberName(node.initializer, staticValues, sourceFile) ?? "",
        ) &&
        isGoogleEventsExpression(
          node.initializer.expression,
          eventObjectAliases,
          staticValues,
          sourceFile,
        )
      ) {
        forbiddenAliases.add(node.name.text);
      }
      if (
        (ts.isPropertyAccessExpression(node.initializer) ||
          ts.isElementAccessExpression(node.initializer)) &&
        staticMemberName(node.initializer, staticValues, sourceFile) ===
          "events"
      ) {
        eventObjectAliases.add(node.name.text);
      }
      if (
        (ts.isIdentifier(node.initializer) &&
          transportAliases.has(node.initializer.text)) ||
        (ts.isCallExpression(node.initializer) &&
          ts.isPropertyAccessExpression(node.initializer.expression) &&
          node.initializer.expression.name.text === "bind" &&
          ts.isIdentifier(node.initializer.expression.expression) &&
          transportAliases.has(
            node.initializer.expression.expression.text,
          ))
      ) {
        transportAliases.add(node.name.text);
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      isGoogleEventsExpression(
        node.initializer,
        eventObjectAliases,
        staticValues,
        sourceFile,
      )
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
      if (
        ts.isPropertyAccessExpression(node.expression) ||
        ts.isElementAccessExpression(node.expression)
      ) {
        const methodName = staticMemberName(
          node.expression,
          staticValues,
          sourceFile,
        );
        const unresolvedComputedMember =
          ts.isElementAccessExpression(node.expression) &&
          methodName === undefined &&
          isGoogleEventsExpression(
            node.expression.expression,
            eventObjectAliases,
            staticValues,
            sourceFile,
          );
        forbiddenSdkCall =
          unresolvedComputedMember ||
          (["insert", "update", "patch", "move", "delete"].includes(
            methodName ?? "",
          ) &&
            isGoogleEventsExpression(
              node.expression.expression,
              eventObjectAliases,
              staticValues,
              sourceFile,
            ));
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
      const isProvenTransport =
        (ts.isIdentifier(node.expression) &&
          transportAliases.has(node.expression.text)) ||
        ((ts.isPropertyAccessExpression(node.expression) ||
          ts.isElementAccessExpression(node.expression)) &&
          node.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
          transportProperties.has(
            staticMemberName(
              node.expression,
              staticValues,
              sourceFile,
            ) ?? "",
          ));
      const endpoint = canonicalExpression(
        node.arguments[0],
        staticValues,
        sourceFile,
      );
      const endpointLooksGoogle =
        endpoint?.includes("googleapis.com") === true ||
        endpoint?.includes("GOOGLE_CALENDAR_BASE_URL") === true;
      const declaredMethod = readHttpMethod(
        node.arguments[1],
        staticValues,
        sourceFile,
      );
      const structurallyProviderBoundCall =
        providerMarkerPresent &&
        node.arguments.length >= 2 &&
        declaredMethod !== undefined;
      if (
        isProvenTransport ||
        calleeName === "request" ||
        endpointLooksGoogle ||
        structurallyProviderBoundCall
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
          ((relativePath ===
            "src/integrations/google-calendar/calendar-client.ts" &&
            calleeName === "fetcher" &&
            enclosingName === "request") ||
            (relativePath ===
              "src/integrations/google-calendar/event-write-client.ts" &&
              calleeName === "fetcher" &&
              enclosingName === "requestJson")) &&
          ts.isIdentifier(node.arguments[0]) &&
          node.arguments[0].text === "url" &&
          ts.isObjectLiteralExpression(node.arguments[1]) &&
          node.arguments[1].properties.some(
            (property) =>
              ts.isSpreadAssignment(property) &&
              ts.isIdentifier(property.expression) &&
              property.expression.text === "init",
          );
        const requestTarget = node.arguments[0];
        const isReviewedEventWriteRequest =
          relativePath ===
            "src/integrations/google-calendar/event-write-client.ts" &&
          calleeName === "requestJson" &&
          [
            "readCalendarVersion",
            "createOneOffEvent",
            "updateEvent",
            "moveEvent",
            "cancelEvent",
            "findByOperationId",
            "readEvent",
            "deleteEvent",
          ].includes(enclosingName ?? "") &&
          declaredMethod !== undefined &&
          requestTarget !== undefined &&
          ((ts.isCallExpression(requestTarget) &&
            ts.isIdentifier(requestTarget.expression) &&
            requestTarget.expression.text === "buildEventsUrl") ||
            (ts.isTemplateExpression(requestTarget) &&
              requestTarget
                .getText(sourceFile)
                .includes("GOOGLE_CALENDAR_BASE_URL")));
        if (!isReviewedTransportForwarder && !isReviewedEventWriteRequest) {
          const method = declaredMethod;
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
                "Google call is unresolved or outside the exact approved operation allowlist",
            });
          }
        }
      }
    }
    node.forEachChild(inspectCalls);
  });

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

  /** Resolves direct, aliased, and chained Hono receiver expressions with their static base path. */
  const resolveHonoReceiver = (
    expression: ts.Expression,
  ): { readonly isHono: boolean; readonly basePath?: string } => {
    if (ts.isIdentifier(expression)) {
      return {
        isHono: honoReceivers.has(expression.text),
        basePath: honoBasePaths.get(expression.text),
      };
    }
    if (
      ts.isNewExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "Hono"
    ) {
      return { isHono: true };
    }
    if (
      ts.isCallExpression(expression) &&
      ts.isPropertyAccessExpression(expression.expression)
    ) {
      const nested = resolveHonoReceiver(expression.expression.expression);
      if (!nested.isHono) return nested;
      if (expression.expression.name.text === "basePath") {
        const basePath = canonicalExpression(
          expression.arguments[0],
          staticValues,
          sourceFile,
        );
        return { isHono: true, basePath };
      }
      return nested;
    }
    return { isHono: false };
  };

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
      (ts.isPropertyAccessExpression(node.expression) ||
        ts.isElementAccessExpression(node.expression))
    ) {
      const receiver = node.expression.expression;
      const resolvedReceiver = resolveHonoReceiver(receiver);
      const registrationName = staticMemberName(
        node.expression,
        staticValues,
        sourceFile,
      );
      if (
        registrationName === undefined &&
        ts.isElementAccessExpression(node.expression) &&
        resolvedReceiver.isHono
      ) {
        violations.push({
          category: "event-write-route",
          file: fileIdentifier,
          reason:
            "computed Hono route registration method is not statically resolvable",
        });
      }
      const registration = registrationName?.toLowerCase();
      if (
        registration !== undefined &&
        [
          "get",
          "post",
          "put",
          "patch",
          "delete",
          "all",
          "on",
          "route",
          "mount",
        ].includes(registration)
      ) {
        const receiverIsHono = resolvedReceiver.isHono;
        const routeArgument =
          registration === "on" ? node.arguments[1] : node.arguments[0];
        const route = canonicalExpression(
          routeArgument,
          staticValues,
          sourceFile,
        );
        const basePath = resolvedReceiver.basePath;
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
          } else if (registration === "route" || registration === "mount") {
            methods = ["MOUNT"];
          } else if (registration === "all") {
            methods = ["ALL"];
          } else {
            methods = [registration.toUpperCase()];
          }

          if (effectiveRoute === undefined || methods === undefined) {
            if (
              receiverIsHono &&
              (methods === undefined ||
                !methods.every((method) => method === "GET"))
            ) {
              violations.push({
                category: "event-write-route",
                file: fileIdentifier,
                reason: "mutating Hono route declaration is not statically resolvable",
              });
            }
          } else {
            const readOnly = methods.every((method) => method === "GET");
            const approvedOperations =
              APPROVED_MUTATING_ROUTES.get(relativePath);
            const explicitlyApproved =
              !readOnly &&
              methods.every((method) =>
                approvedOperations?.some(
                  (operation) =>
                    operation.method === method &&
                    operation.route === effectiveRoute,
                ),
              );
            if (!readOnly && !explicitlyApproved) {
              violations.push({
                category: "event-write-route",
                file: fileIdentifier,
                reason:
                  "mutating Hono route is outside the exact Phase B route allowlist",
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
    [...Buffer.from(options.protectedSentinel, "utf8")]
      .map((byte) => `%${byte.toString(16).padStart(2, "0").toLowerCase()}`)
      .join(""),
    Buffer.from(options.protectedSentinel, "utf8").toString("base64"),
    Buffer.from(options.protectedSentinel, "utf8").toString("base64url"),
  ]);
  const forbiddenFileFragments = [
    ...protectedVariants,
    ...CLIENT_FORBIDDEN_BINDING_NAMES,
    ...CLIENT_FORBIDDEN_RUNTIME_VALUES,
  ];
  const manifestPath = resolve(projectRoot, EVIDENCE_MANIFEST_PATH);
  let evidenceManifest: ReleaseEvidenceManifest | undefined;
  try {
    const manifestStat = await lstat(manifestPath);
    if (
      manifestStat.isSymbolicLink() ||
      !manifestStat.isFile() ||
      manifestStat.size > 16 * 1024
    ) {
      throw new Error("unacceptable-manifest");
    }
    const currentBuildDigest = await computeReleaseBuildDigest(projectRoot);
    evidenceManifest = parseEvidenceManifest(
      await readFile(manifestPath, "utf8"),
      currentBuildDigest,
      Date.now(),
    );
    if (!evidenceManifest) throw new Error("invalid-manifest");
  } catch {
    violations.push({
      category: "missing-evidence",
      file: safeFileIdentifier(
        projectRoot,
        manifestPath,
        forbiddenFileFragments,
      ),
      reason:
        "fresh release evidence manifest is absent, invalid, or not bound to the current build",
    });
  }
  const scanTargets = [
    {
      relativePath: "dist/client",
      kind: "directory" as const,
      protectedValues: true,
      secretBindings: true,
      sourceKind: undefined,
      evidenceSurface: undefined,
      evidenceSource: undefined,
    },
    {
      relativePath: "dist/vision",
      kind: "directory" as const,
      protectedValues: true,
      secretBindings: false,
      sourceKind: undefined,
      evidenceSurface: undefined,
      evidenceSource: undefined,
    },
    ...EVIDENCE_TARGETS.map((target) => ({
      relativePath: target.relativePath,
      kind: "file" as const,
      protectedValues: true,
      secretBindings: false,
      sourceKind: undefined,
      evidenceSurface: target.surface,
      evidenceSource: target.source,
    })),
    {
      relativePath: "src",
      kind: "directory" as const,
      protectedValues: false,
      secretBindings: false,
      sourceKind: "google" as const,
      evidenceSurface: undefined,
      evidenceSource: undefined,
    },
    {
      relativePath: "src",
      kind: "directory" as const,
      protectedValues: false,
      secretBindings: false,
      sourceKind: "routes" as const,
      evidenceSurface: undefined,
      evidenceSource: undefined,
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
  const r2CapabilitySources = new Map<string, string>();

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
      const relativePath = relative(projectRoot, file).replaceAll("\\", "/");
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
        target.evidenceSource &&
        !hasValidEvidenceProvenance(
          text,
          target.evidenceSurface,
          target.evidenceSource,
          evidenceManifest,
        )
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
        [
          ...CLIENT_FORBIDDEN_BINDING_NAMES,
          ...CLIENT_FORBIDDEN_RUNTIME_VALUES,
        ].some((literal) =>
          text.includes(literal),
        )
      ) {
        violations.push({
          category: "client-secret-binding",
          file: fileIdentifier,
          reason: "server-only binding name is present in a client asset",
        });
      }
      if (target.sourceKind && /\.tsx?$/u.test(relativePath)) {
        if (target.relativePath === "src") {
          r2CapabilitySources.set(relativePath, text);
        }
        sourceFiles.set(`${target.sourceKind}:${relativePath}`, {
          relativePath,
          sourceKind: target.sourceKind,
          text,
          fileIdentifier,
        });
      }
    }
  }

  for (const relativeDirectory of ["scripts", ".github/workflows"]) {
    const pending = [resolve(projectRoot, relativeDirectory)];
    while (pending.length > 0) {
      const directory = pending.pop();
      if (!directory) break;
      let entries;
      try {
        const stat = await lstat(directory);
        if (stat.isSymbolicLink() || !stat.isDirectory()) break;
        entries = await readdir(directory, { withFileTypes: true });
      } catch {
        break;
      }
      for (const entry of entries) {
        const absolutePath = resolve(directory, entry.name);
        if (entry.isDirectory()) {
          pending.push(absolutePath);
        } else if (
          entry.isFile() &&
          (/\.[cm]?[jt]sx?$/u.test(entry.name) || /\.ya?ml$/u.test(entry.name))
        ) {
          const relativePath = relative(projectRoot, absolutePath).replaceAll(
            "\\",
            "/",
          );
          try {
            r2CapabilitySources.set(
              relativePath,
              await readFile(absolutePath, "utf8"),
            );
          } catch {
            violations.push({
              category: "missing-evidence",
              file: safeFileIdentifier(
                projectRoot,
                absolutePath,
                forbiddenFileFragments,
              ),
              reason: "R2 capability source is unreadable",
            });
          }
        }
      }
    }
  }
  for (const relativePath of ["package.json", "wrangler.jsonc"]) {
    const absolutePath = resolve(projectRoot, relativePath);
    try {
      const stat = await lstat(absolutePath);
      if (!stat.isSymbolicLink() && stat.isFile()) {
        r2CapabilitySources.set(relativePath, await readFile(absolutePath, "utf8"));
      }
    } catch {
      // Optional in minimal scanner fixtures; required release inputs are checked elsewhere.
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

  for (const finding of scanR2DeletionCapabilities(r2CapabilitySources)) {
    if (finding.capability === "unexpected") {
      violations.push({
        category: "r2-deletion-capability",
        file: finding.path,
        reason: "R2 deletion capability is outside the exact release allowlist",
      });
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
