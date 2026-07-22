/** Validates that Vision production code has mirrored references and JSDoc contracts. */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const DOCUMENTATION_LAYERS = ["simple", "technical"] as const;
const PRODUCTION_ROOTS = ["src", "scripts"] as const;

/** Lists all TypeScript production files beneath the supported source roots. */
function findProductionFiles(projectRoot: string): string[] {
  return PRODUCTION_ROOTS.flatMap((sourceRoot) => {
    const root = resolve(projectRoot, sourceRoot);

    if (!existsSync(root)) {
      return [];
    }

    return collectFiles(root, projectRoot);
  });
}

/** Collects eligible source files from a directory without following excluded paths. */
function collectFiles(directory: string, projectRoot: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = resolve(directory, entry);

    if (statSync(entryPath).isDirectory()) {
      return shouldExclude(entryPath, projectRoot) ? [] : collectFiles(entryPath, projectRoot);
    }

    return shouldCheckFile(entryPath, projectRoot) ? [entryPath] : [];
  });
}

/** Returns whether a source path is intentionally outside the production documentation contract. */
function shouldExclude(path: string, projectRoot: string): boolean {
  const segments = relative(projectRoot, path).split(sep);
  return segments.some((segment) => ["fixtures", "generated", "migrations", "tests"].includes(segment));
}

/** Returns whether a file is a non-configuration TypeScript production source. */
function shouldCheckFile(path: string, projectRoot: string): boolean {
  const relativePath = relative(projectRoot, path).replaceAll("\\", "/");
  return (
    !shouldExclude(path, projectRoot) &&
    /\.tsx?$/.test(path) &&
    !/\.d\.ts$/.test(path) &&
    !/\.(test|spec)\.tsx?$/.test(path) &&
    !/(^|\/)[^/]+\.config\.tsx?$/.test(relativePath)
  );
}

/** Finds named functions, React components, and class methods that require documentation. */
function findNamedApiNodes(sourceFile: ts.SourceFile): ts.Node[] {
  const nodes: ts.Node[] = [];

  /** Visits each syntax node and records supported named API declarations. */
  const visit = (node: ts.Node): void => {
    if (
      (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
      node.name &&
      ts.isIdentifier(node.name)
    ) {
      nodes.push(node);
    }

    if (
      (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node)) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      nodes.push(node);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return nodes;
}

/** Reads the stable identifier used by a documented named API node. */
function getNodeName(node: ts.Node): string {
  if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) {
    return node.name.getText();
  }

  if (
    (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node)) &&
    ts.isIdentifier(node.name)
  ) {
    return node.name.text;
  }

  return "<anonymous>";
}

/** Reports whether a source node has an attached JSDoc comment. */
function hasJSDoc(node: ts.Node): boolean {
  return ts.getJSDocCommentsAndTags(node).some((comment) => ts.isJSDoc(comment));
}

/** Reports whether a source module begins with a module-level JSDoc comment. */
function hasModuleJSDoc(sourceFile: ts.SourceFile): boolean {
  const leadingComments = ts.getLeadingCommentRanges(sourceFile.text, 0) ?? [];
  const jsDocCount = leadingComments.filter((comment) => sourceFile.text.slice(comment.pos, comment.end).startsWith("/**")).length;
  const firstStatement = sourceFile.statements[0];

  return (
    jsDocCount > 1 ||
    !firstStatement ||
    ts.isImportDeclaration(firstStatement) ||
    ts.isImportEqualsDeclaration(firstStatement)
  );
}

/** Maps a production source file to one mirrored documentation file. */
function getReferencePath(projectRoot: string, layer: (typeof DOCUMENTATION_LAYERS)[number], sourcePath: string): string {
  const sourceRelativePath = relative(projectRoot, sourcePath).replaceAll("\\", "/");
  return resolve(projectRoot, "docs", "reference", layer, sourceRelativePath.replace(/\.tsx?$/, ".md"));
}

/** Requires guides for nested architectural source folders but not source-root containers. */
function findArchitecturalFolders(projectRoot: string, sourcePaths: string[]): string[] {
  const folders = new Set<string>();

  for (const sourcePath of sourcePaths) {
    const segments = relative(projectRoot, resolve(sourcePath, "..")).replaceAll("\\", "/").split("/");
    for (let length = 2; length <= segments.length; length += 1) {
      folders.add(segments.slice(0, length).join("/"));
    }
  }

  return [...folders];
}

/** Validates the full mirrored reference and JSDoc contract for a project root. */
export function validateDocumentationCoverage(projectRoot = process.cwd()): string[] {
  const root = resolve(projectRoot);
  const violations: string[] = [];
  const sourcePaths = findProductionFiles(root);

  for (const sourcePath of sourcePaths) {
    const sourceRelativePath = relative(root, sourcePath).replaceAll("\\", "/");
    const sourceText = readFileSync(sourcePath, "utf8");
    const sourceFile = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true);

    if (!hasModuleJSDoc(sourceFile)) {
      violations.push(`${sourceRelativePath}: missing module JSDoc`);
    }

    for (const layer of DOCUMENTATION_LAYERS) {
      const referencePath = getReferencePath(root, layer, sourcePath);
      if (!existsSync(referencePath)) {
        violations.push(`${sourceRelativePath}: missing ${layer} reference`);
      }
    }

    for (const node of findNamedApiNodes(sourceFile)) {
      const name = getNodeName(node);
      if (!hasJSDoc(node)) {
        violations.push(`${sourceRelativePath}: ${name} is missing JSDoc`);
      }

      for (const layer of DOCUMENTATION_LAYERS) {
        const referencePath = getReferencePath(root, layer, sourcePath);
        const referenceText = existsSync(referencePath) ? readFileSync(referencePath, "utf8") : "";
        if (!new RegExp(`^##\\s+\\\`${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\\``, "m").test(referenceText)) {
          violations.push(`${sourceRelativePath}: ${name} is missing a ${layer} reference heading`);
        }
      }
    }
  }

  for (const folder of findArchitecturalFolders(root, sourcePaths)) {
    for (const layer of DOCUMENTATION_LAYERS) {
      const guidePath = resolve(root, "docs", "reference", layer, folder, "_folder.md");
      if (!existsSync(guidePath)) {
        violations.push(`${folder}: missing ${layer} folder guide`);
      }
    }
  }

  return violations;
}

/** Writes documentation violations to standard error and signals CI failure. */
function run(): void {
  const violations = validateDocumentationCoverage();
  if (violations.length === 0) {
    return;
  }

  console.error("Documentation coverage failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
