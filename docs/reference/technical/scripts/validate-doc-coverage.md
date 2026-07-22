# `scripts/validate-doc-coverage.ts`

This TypeScript compiler-API validator scans `src/` and `scripts/` production modules. It excludes generated declarations, `tests`, `migrations`, and supported configuration files. Each checked module requires a leading module JSDoc comment, mirrored simple and technical Markdown files, JSDoc for every named function, arrow/function-expression value, or method, and a matching level-two backticked heading in each reference file. Nested source folders require mirrored `_folder.md` guides.

## `findProductionFiles`

Collects documentation-contract source paths from the supported production roots.

## `collectFiles`

Recursively enumerates eligible production paths while avoiding excluded directories.

## `shouldExclude`

Identifies fixture, generated, migration, and test path segments excluded from coverage.

## `shouldCheckFile`

Restricts validation to non-declaration TypeScript and TSX production files, excluding test/spec and all conventional `.config.ts` or `.config.tsx` filenames.

## `findNamedApiNodes`

Uses the TypeScript abstract syntax tree to find named function declarations, class methods, named variables, object properties, and class fields initialized with a function or arrow function.

## `visit`

Recursively traverses a parsed source file and adds supported named declarations to the documentation-contract result set.

## `getNodeName`

Normalizes the name read from one supported TypeScript declaration, object-property, or class-field node.

## `hasJSDoc`

Uses TypeScript JSDoc comment/tag discovery to require an attached documentation comment.

## `hasModuleJSDoc`

Uses leading-comment count and the first statement's AST shape. One leading JSDoc is valid before an import or a non-function import-free declaration, but a named function or function-valued variable needs a separate module comment. This prevents a function contract from falsely satisfying module documentation without imposing a new tag convention.

## `getReferencePath`

Maps a source-relative TypeScript path to its simple or technical Markdown reference path.

## `findArchitecturalFolders`

Returns every nested source folder and its architectural ancestors that require mirrored `_folder.md` guidance while leaving `src` and `scripts` root containers optional.

## `validateDocumentationCoverage`

Validates the two reference layers, headings, module comments, function comments, and folder guides, returning human-readable violations for tests and CI.

## `run`

Acts as the CLI entry point: it writes every violation to standard error and sets a nonzero exit code without allocating external resources.
