# Release security scanner

This script checks the exact local evidence that can safely be inspected before a Phase B release. It looks for the protected test marker in built browser files and freshly generated log, audit, queue, raw-database, and unencrypted-R2 evidence. It also blocks server-only secret binding names from browser assets and blocks Google Calendar event-write calls or Worker event-write routes.

The scanner reports only a safe category and repository-relative file name. It never prints matched text.

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

Scans one project root and returns every safe release-boundary violation. Missing, unreadable, oversized, or symbolic-link evidence fails closed instead of being skipped.
