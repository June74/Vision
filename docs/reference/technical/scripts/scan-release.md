# Release security scanner

`scripts/scan-release.ts` is the deterministic local release boundary for Phase B privacy and read-only guarantees.

It recursively reads bounded regular files from the built client, deployable
Worker bundle, and five required generated evidence surfaces. It rejects plain,
URI-encoded, fully percent-encoded, base64, and base64url forms of the protected
sentinel. Client assets are separately checked for a closed list of server-only
binding names; the Worker target leaves that name check disabled so server code
may reference runtime bindings.

Google provider inspection is allowlist-based. Provider endpoints are accepted only in the three reviewed adapter files and only when their literal endpoint family is approved for OAuth, calendar setup, event reads/watch, or channel stop. SDK event mutation methods and non-watch event HTTP mutations are rejected. Worker route declarations are parsed from literal Hono route calls; event reads and the Vision-only category-correction route are allowed, while create/update/move/cancel/delete event routes are rejected. A separate TypeScript-AST capability analysis confines R2 object deletion to its three structural production paths.

The command emits only pass/fail plus violation category and repository-relative path. Content, tokens, identifiers, and matched values are never printed.

## `scanR2DeletionCapabilities`

Accepts an in-memory map of repository-relative paths to source text and returns a deterministic ordinal-sorted list of `R2DeletionCapabilityFinding` values. Findings expose only `path` and the closed `adapter`, `failed_verification_cleanup`, `validated_retention`, or `unexpected` category.

For TypeScript and TSX, the scanner builds one closed in-memory program and uses TypeScript's lexical binder to compare symbols rather than identifier strings. It discovers types that transitively carry the `delete` member and follows typed stores, property aliases, destructuring, direct returns, callback arguments, later assignments, `.bind()` callbacks, default or named exported factories, renamed imports, and renamed re-exports. Capability export names still propagate to a fixed point across static relative module edges, rather than by whole-file substring matching. JavaScript-form TypeScript specifiers are normalized back to their source extension. The permanent scheduler is allowed to orchestrate the exact three reviewed modules but gains no direct delete method; a direct delete added there still fails closed.

The three accepted source paths receive additional structural checks:

- `src/data/backup/r2-object-store.ts` may expose the shared adapter's single deletion only from the exported `createR2BackupObjectStore` declaration. The delete receiver must bind to that function's bucket parameter, and its argument must bind to the exact delete-method key parameter.
- `src/jobs/create-daily-backup.ts` may delete only the immutable `objectKey` derived from the local `dailyObjectKey(createdDate)` declaration, where immutable `createdDate` came from the local `utcDate(now)` declaration. The uninitialized `created` binding must receive its sole pre-delete write from the awaited create-if-absent call. The delete-owning catch's paired try block must contain exactly one executable statement: a direct `return await verifyStoredBackup(...)` whose callee is the exact non-optional local identifier, with exactly five arguments in production order. The first and fourth must be direct non-optional properties on the exact dependencies symbol, respectively `dependencies.store` and `dependencies.backupKey`; the second and third must be the exact key and date symbols; the fifth must be the non-throwing `created ? "created" : "existing"` conditional. Optional calls, extra or arbitrary arguments, a verification call nested beneath a conditional or wrapper, or any preceding or parallel throwing statement cannot approve cleanup. The catch may delete only inside the exact positive `created` branch. Shadowed declarations, later assignment, negation, disjunction, indirect delete callbacks, and unrelated verification fail.
- `src/jobs/purge-expired-backups.ts` requires the top-level exported `const BACKUP_RETENTION_DAYS = 30` binding and immutable `DAY_MILLISECONDS`, plus `today = utcDateMilliseconds(now)` from the exact local declarations. It may delete only the unchanged `object.key` from the same immutable `for (const object ...)` symbol after immutable `createdDate = validatedBackupObjectDate(object)`, a direct undefined-date branch ending in unlabelled `continue`, and the exact immutable `(today - createdDate) / DAY_MILLISECONDS` derivation. The guard must bind those exact symbols in `ageDays >= BACKUP_RETENTION_DAYS`. Direct writes, property writes through any pre-call alias, or passing an object alias to any other call fail closed.

Workflow YAML and reviewed JSON/JSONC configuration entries are inspected separately as command records. Quoted or unquoted YAML `run` keys using literal or folded scalars, with optional keep or strip chomping indicators, are supported. A block body begins at the first nonblank content indentation; collection stops at the first nonblank line with less indentation, so sibling `env`, `with`, or step fields are never combined with the command. A command-level combination of R2/backup scope and an explicit or indirect `delete`, `remove`, `cleanup`, `purge`, or `destroy` verb is unexpected. This closes multiline and helper-command hiding without creating a false positive from adjacent fields. Non-R2 `Map.delete` and database query-builder deletion stay outside the boundary.

## `normalizeRepositoryPath`

Canonicalizes map keys to repository-relative forward-slash paths, collapses `.` segments, and bounds `..` by removing the preceding in-map segment. No host path is resolved or emitted.

## `resolveSourceMapModule`

Resolves only a relative static module specifier against its importing source-map key and supplies the TypeScript extension when absent. Package imports remain opaque.

## `r2MemberName`

Returns a member only for dot access or a literal string/template element access. Computed expressions remain unresolved.

## `exportedOwnerName`

Walks syntax-tree parents to the nearest explicitly exported function, class, or first named variable declaration. This binds cross-module propagation to an exported owner rather than a whole-file text match.

## `createR2TypeScriptProgram`

Creates one `noLib`/`noResolve` in-memory TypeScript program from only the supplied source map. Its type checker is used as a lexical symbol table; it does not load host modules, execute source, or admit semantic inference as policy proof. The known `BackupObjectStore` type-only edge is seeded only for its exact reviewed module path and imported declaration name.

## `bindingOf`

Returns the TypeScript symbol selected by the lexical binder for one identifier.

## `unwrapR2Expression`

Strips only parentheses, assertion forms, non-null syntax, and `satisfies`, which cannot change the underlying declaration identity.

## `expressionBindsTo`

Requires an unwrapped identifier's symbol to equal the approved declaration symbol by reference. Same-spelled catch, block, parameter, and function-local shadows therefore remain distinct.

## `analyzeR2TypeScript`

Consumes the source file and checker from the closed in-memory program, computes the transitive capability-type-symbol set, taints bounded object and callback symbols to a fixed point, records direct delete calls, and records static named import/re-export edges. It does not execute source or rely on successful semantic type checking.

## `typeHasCapability`

Walks identifiers in a declared type node and accepts it only when the lexical symbol belongs to the syntax-derived transitive capability-type set. The ambient `R2Bucket` boundary remains an explicit closed seed.

## `expressionIsTaintedObject`

Recognizes proven identifier symbols, bounded wrappers, and property chains rooted in a proven object symbol. Dynamic calls do not become tainted; module capability continues through the separate fixed-point import graph.

## `workflowOrConfigHasR2Deletion`

Restricts explicit non-TypeScript inspection to workflow YAML and reviewed JSON/JSONC configuration names. It recognizes quoted or unquoted `run` keys and the complete `|`, `|-`, `|+`, `>`, `>-`, or `>+` scalar family. For a block scalar, the first nonblank content line establishes the body indentation and the first shallower nonblank line ends it, preventing sibling-field contamination. Workflow `run` context is itself operational; configuration documents still require an operational field or command token.

## `approvedR2CapabilityIsStructurallyValid`

Dispatches to three path-specific validators after requiring exactly one direct delete call. Each validator proves exported owner, receiver, argument, guard, and helper calls through exact declaration symbols. The creation validator proves the complete date/key/create/verify/catch chain. The retention validator proves top-level immutable constants, UTC-day and age derivation, direct loop-local rejection order, and conservative pre-delete direct/alias mutation absence.

## `hasModifier`

Uses TypeScript's modifier API to require an exact modifier on a declaration.

## `singleTopLevelFunction`

Returns a top-level function only when its approved name is unique in the source file.

## `singleTopLevelVariable`

Returns a top-level variable only when its approved name is unique in the source file.

## `directVariable`

Returns a variable only when it is uniquely declared directly in the supplied block, excluding nested shadows.

## `declarationIsConst`

Checks the declaration-list flags for the exact immutable `const` form.

## `nodeIsWithin`

Compares source intervals to prove one syntax node belongs to a required branch or owner.

## `nearestAncestor`

Walks parents to the first node satisfying a typed syntax predicate.

## `expressionIsRootedAt`

Follows harmless wrappers, property access, and exact nullish alternatives while requiring every root to be one declaration symbol.

## `directMemberCall`

Accepts only dot or literal-element calls whose method name is statically equal to the required operation.

## `bindingWritesBefore`

Finds assignment and unary writes to one exact symbol before the deletion call's source position.

## `conditionalUsesCreationBinding`

Requires the status conditional to use the exact create-result symbol and the closed `created`/`existing` literals.

## `validateR2Adapter`

Requires one exported adapter owner, its exact bucket receiver, its delete-method key parameter, and no pre-call mutation.

## `validateSameInvocationCleanup`

Requires exact local helper symbols and declaration order for date, key, create-if-absent, verification return, catch, positive guard, and direct store deletion. The paired try's direct statement list must contain only one return whose expression is directly an await and whose awaited expression is directly the exact non-optional local verification identifier call. That call must have exactly five arguments: direct `dependencies.store`, the exact key and date symbols, direct `dependencies.backupKey`, and the exact non-throwing created-versus-existing conditional.

## `undefinedGuardContinuesCurrentLoop`

Requires the admitted validation guard's direct `then` statement, or the final direct statement of its block, to be an unlabelled `continue`. A nested or labelled continue cannot prove rejection of the current retention object.

## `collectObjectAliasesBefore`

Computes a conservative fixed point of direct pre-delete aliases of the validated loop object.

## `expressionBindsToAny`

Checks whether one unwrapped identifier resolves to any symbol in the closed alias set.

## `objectAliasCanBeMutatedBefore`

Rejects any binding/property write, unary/delete mutation, receiver call, or unapproved call argument reachable through the alias set. Only the exact validator call and final delete call are exempt.

## `validateRetentionCleanup`

Requires the exported immutable 30-day constant, immutable day length, exact UTC-day derivation, exact loop-object validation and rejection, exact age calculation, exact guard bindings, strict order, and zero pre-delete direct or alias mutation.

## `safeFileIdentifier`

Normalizes a path relative to the project root and permits only a bounded ASCII path grammar with no parent segment or protected/secret fragment. Other names become a stable truncated SHA-256 identifier, preventing attacker-controlled filenames or control characters from entering CI output.

## `canonicalExpression`

Uses the TypeScript abstract syntax tree to resolve only string literals, no-substitution templates, template source forms, previously resolved identifiers, parenthesized/asserted values, bounded `+` concatenation, `toString()` on a resolved value, and `new URL()` around a resolved value. Every other expression stays unresolved and therefore fails closed at a provider or route boundary.

## `readHttpMethod`

Extracts a `method` property or shorthand only from an object literal and resolves it through the same bounded constant map. Spread-only, computed, dynamic, or absent methods remain unresolved.

## `staticMemberName`

Returns member names for TypeScript property access or element access resolved through the scanner's bounded constant table. Dynamic computed members remain unresolved and fail closed at proven Hono or Google event boundaries.

## `isGoogleEventsExpression`

Recognizes `.events`, `["events"]`, and identifiers previously proven to alias that collection. This shared predicate lets direct calls, method aliases, object aliases, and object destructuring use the same SDK mutation boundary.

## `hasValidEvidenceProvenance`

Parses at most 1,000 nonempty JSON-lines records. Each record must declare evidence version 1 and match the accepted manifest's exact build digest, capture time, generator, random run identifier, expected surface, and reviewed production source boundary.

## `computeReleaseBuildDigest`

Traverses `dist/client` without following symbolic links and hashes every relative path, byte length, and file body in sorted order. The length framing prevents path/content concatenation ambiguity.

## `parseEvidenceManifest`

Requires the exact version-1 manifest shape, reviewed generator, canonical random version-4 run identifier, canonical ISO timestamp no more than ten minutes old, and the recomputed client-build SHA-256 digest. A future, stale, malformed, or mismatched manifest fails closed.

## `scanGoogleSource`

Builds a bounded static-value table across every production source file, detects direct and aliased Google event SDK mutations, proves renamed transports from `typeof fetch` declarations, aliases, typed properties, and properties initialized from `fetch` or `fetch.bind`, recognizes provider calls from their resolved endpoint, and checks the exact `(adapter file, endpoint pattern, HTTP method)` allowlist. In a source containing a Google provider marker, any two-argument call with a statically declared HTTP method is treated as provider-bound even when its callee and endpoint are unresolved. Unresolved computed event methods and unresolved endpoints therefore fail closed across typed, inferred, bound, and renamed transports.

## `scanRouteSource`

Builds static route-path and method values and discovers Hono receivers from parameter types, variable types, `new Hono`, reviewed `.basePath()` chains, and simple aliases. It composes base paths, parses dot or computed verbs plus `.all`, `.on` method arrays, `.route`, and `.mount`, and permits only an exact file/method/path manifest for current mutating Phase B routes. All other mutating or unresolved Hono registrations are rejected, including routes whose names omit `events`.

## `resolveHonoReceiver`

Recursively resolves identifiers, direct `new Hono()` expressions, `.basePath()` calls, and chained Hono registrations. It returns only a boolean Hono proof plus an optional statically resolved base path; dynamic base paths remain unresolved and fail closed when used for mutation.

## `scanRelease`

Resolves a project root, verifies the fresh build-bound manifest, requires both
`dist/client` and `dist/vision`, validates required evidence files, bounds each
input to 16 MiB, rejects symbolic links, scans protected encodings in both
bundles, scans secret-binding names only in client assets, evaluates the Google
call allowlist and Worker route manifest, sorts safe violations
deterministically, and returns them without exposing matched content. It also
collects production TypeScript plus present script, workflow, and reviewed
configuration inputs, calls `scanR2DeletionCapabilities`, and converts only
`unexpected` findings to the closed `r2-deletion-capability` release category.
