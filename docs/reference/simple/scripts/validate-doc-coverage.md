# `scripts/validate-doc-coverage.ts`

This script checks that Vision's production TypeScript files have matching simple and technical documentation. It also checks module comments, function comments, function headings, and folder guides.

## `findProductionFiles`

Finds the production TypeScript files that need documentation.

## `collectFiles`

Walks a production folder and keeps only files that the check should inspect.

## `shouldExclude`

Skips fixture, generated, migration, and test paths.

## `shouldCheckFile`

Decides whether one non-configuration TypeScript file belongs to the production documentation check.

## `findNamedApiNodes`

Finds named functions, methods, object-property functions, class-field functions, and React-style function values that need comments and headings.

## `visit`

Walks one source file's code structure and records supported named code items.

## `getNodeName`

Reads the name of one documented function, method, object property, or class field.

## `hasJSDoc`

Checks whether one code item has a JSDoc comment.

## `hasModuleJSDoc`

Checks whether a source file has a distinct module comment instead of only a function comment.

## `getReferencePath`

Finds the matching simple or technical documentation file for source code.

## `findArchitecturalFolders`

Finds every nested source folder, including parent folders, that needs matching folder guides.

## `validateDocumentationCoverage`

Returns all missing-documentation problems for a project root. Continuous integration runs this through `pnpm docs:check`.

## `run`

Prints violations and gives the command a failing exit code when documentation is incomplete.
