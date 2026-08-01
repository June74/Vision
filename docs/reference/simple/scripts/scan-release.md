# Release security scanner

This script checks the exact local evidence that can safely be inspected before a Phase B release. It looks for the protected test marker in built browser files, the deployable Worker bundle, and freshly generated log, audit, queue, raw-database, and unencrypted-R2 evidence. It also blocks server-only secret binding names from browser assets, blocks Google Calendar event-write calls or Worker event-write routes, and proves that R2 object deletion remains confined to the shared adapter and its two permanent policy-guarded callers.

The scanner reports only a safe category and repository-relative file name. It never prints matched text.

## `scanR2DeletionCapabilities`

Uses one in-memory TypeScript program to follow R2 store aliases, destructured or renamed delete methods, direct returns and callback arguments, later assignments, bound callbacks, default or named exported factories, renamed imports, and re-exports. Identifier uses are compared to their exact lexical declaration, so a catch-local or nested variable with the same spelling cannot satisfy an approved guard or argument. Workflow and configuration command entries receive a separate explicit inspection, including multiline commands and indirect cleanup, purge, or destroy names. The result contains only repository-relative paths and one of four closed categories: shared adapter, same-backup failed-verification cleanup, independently validated retention, or unexpected.

The accepted paths are exact. Daily-backup cleanup must stay inside the catch belonging to the exact `verifyStoredBackup` call and the positive `created` branch for that invocation's `objectKey`. The date, key, create result, verification arguments, guard, and delete argument must all bind to the reviewed declarations in creation order and cannot be reassigned before deletion. Negated, permissive, shadowed, or unrelated verification conditions fail. Retention requires an exported immutable 30-day binding, the exact validated loop-object binding, the reviewed UTC-day and age calculation, the undefined-date `continue`, and the exact comparison and delete call in order. Direct mutation, mutation through an object alias, passing that alias to an unapproved call, a distant validator, or a same-spelled shadow cannot authorize deletion. A temporary source or workflow that gains the capability is always unexpected. Ordinary `Map.delete` and database deletion are not mistaken for R2 object deletion.

## `normalizeRepositoryPath`

Turns a source-map key into one stable repository-relative slash path.

## `resolveSourceMapModule`

Resolves a static relative TypeScript import inside the supplied source map.

## `r2MemberName`

Reads only a fixed dot or string-bracket member name.

## `exportedOwnerName`

Finds the exported function, class, or variable that owns a proven capability use.

## `createR2TypeScriptProgram`

Builds the closed in-memory source program used only to bind identifiers to declarations. It does not read imported modules from the host filesystem.

## `bindingOf`

Returns the lexical declaration identity for one identifier.

## `unwrapR2Expression`

Removes only syntax wrappers that do not change declaration identity.

## `expressionBindsTo`

Compares an identifier expression with one exact declaration instead of its text.

## `analyzeR2TypeScript`

Builds the syntax-tree facts used to follow types, aliases, callbacks, factories, imports, and direct delete calls.

## `typeHasCapability`

Checks whether a declared type carries the reviewed deletion-capable storage port.

## `expressionIsTaintedObject`

Follows only bounded expressions already proven to hold that port.

## `workflowOrConfigHasR2Deletion`

Inspects each workflow or configuration command entry for an operational R2 deletion instruction, including quoted `run` keys and every valid literal/folded multiline chomping form. A block scalar starts at its first nonblank content indentation and ends before a sibling field, so an `env` or other sibling cannot be merged into the `run` command.

## `approvedR2CapabilityIsStructurallyValid`

Applies the exact adapter, failed-verification, or 30-day-retention guard for one allowlisted source path using declaration identity, call order, immutable origin checks, and conservative alias/mutation analysis.

## `hasModifier`

Checks one declaration for an exact TypeScript modifier.

## `singleTopLevelFunction`

Finds one uniquely named top-level function.

## `singleTopLevelVariable`

Finds one uniquely named top-level variable.

## `directVariable`

Finds one uniquely named variable declared directly in a block.

## `declarationIsConst`

Proves a variable was declared with `const`.

## `nodeIsWithin`

Checks that one syntax node is contained by another.

## `nearestAncestor`

Finds the closest parent matching one syntax kind.

## `expressionIsRootedAt`

Proves a property or nullish chain starts at one exact declaration.

## `directMemberCall`

Accepts only a direct, statically named method call.

## `bindingWritesBefore`

Finds writes to one declaration that occur before deletion.

## `conditionalUsesCreationBinding`

Proves the exact `created ? "created" : "existing"` status choice.

## `validateR2Adapter`

Proves the adapter delete uses its exact bucket and key parameters.

## `validateSameInvocationCleanup`

Proves the complete daily create, verify, catch, guard, and delete lifecycle. The catch's try block must contain exactly one executable statement: a direct, non-optional `return await verifyStoredBackup(...)` with exactly five arguments. Those arguments must be the direct `dependencies.store` property, approved key and date bindings, direct `dependencies.backupKey` property, and the non-throwing final created-status conditional. Optional calls and extra, arbitrary, conditional, nested, or parallel throwing expressions cannot qualify.

## `undefinedGuardContinuesCurrentLoop`

Confirms that the direct undefined-date rejection branch ends with an unlabelled `continue` for the current retention loop.

## `collectObjectAliasesBefore`

Finds direct aliases of the validated retention object before deletion.

## `expressionBindsToAny`

Checks an expression against a closed set of declaration identities.

## `objectAliasCanBeMutatedBefore`

Rejects writes or unapproved calls that could change the validated object through an alias.

## `validateRetentionCleanup`

Proves the immutable 30-day date, age, guard, object, and deletion chain.

## `safeFileIdentifier`

Returns a normal repository-relative path only when its characters and length are safe for CI. Otherwise it returns a short one-way identifier instead of echoing an unsafe filename.

## `canonicalExpression`

Resolves only simple source-code values the scanner can prove: strings, templates, known constants, simple concatenation, and reviewed URL wrappers.

## `readHttpMethod`

Reads an HTTP method only when the request options contain a statically known method.

## `staticMemberName`

Reads a member name from ordinary dot access or a bracket value the scanner can prove from a fixed constant.

## `isGoogleEventsExpression`

Recognizes direct and safely aliased Google Calendar event collections, including bracket notation.

## `hasValidEvidenceProvenance`

Requires every generated record to match the fresh manifest's build digest, time, run identifier, surface, and real production source boundary.

## `computeReleaseBuildDigest`

Creates one stable fingerprint from every regular file in the current browser build.

## `parseEvidenceManifest`

Accepts only a complete capture made in the last ten minutes for the exact browser build being scanned.

## `scanGoogleSource`

Parses Google adapter calls and accepts only the exact reviewed file, endpoint family, and HTTP-method combinations. In a Google-marked source file, unresolved HTTP-shaped calls fail closed even when their transport has been renamed or inferred.

## `scanRouteSource`

Parses Hono route declarations regardless of receiver name, resolves bounded path constants and base paths, covers `.all`, `.on`, `.route`, and `.mount`, and permits only the exact reviewed mutating routes already required by Phase B.

## `resolveHonoReceiver`

Recognizes direct, renamed, and chained Hono applications and carries their known base path into route review.

## `scanRelease`

Scans one project root and returns every safe release-boundary violation. The
browser build and Worker bundle are both required. Protected values are
rejected from both, while server-only binding names are rejected only from the
browser build. Missing, unreadable, oversized, or symbolic-link evidence fails
closed instead of being skipped. It also supplies current production,
script, workflow, and configuration sources to `scanR2DeletionCapabilities`
and turns every `unexpected` result into a safe release violation, so the real
security command enforces the R2 allowlist.
