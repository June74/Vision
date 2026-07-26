# Release security scanner

`scripts/scan-release.ts` is the deterministic local release boundary for Phase B privacy and read-only guarantees.

It recursively reads bounded regular files from the built client and five required evidence surfaces. It rejects plain, URI-encoded, fully percent-encoded, base64, and base64url forms of the protected sentinel. Client assets are separately checked for a closed list of server-only binding names.

Google provider inspection is allowlist-based. Provider endpoints are accepted only in the three reviewed adapter files and only when their literal endpoint family is approved for OAuth, calendar setup, event reads/watch, or channel stop. SDK event mutation methods and non-watch event HTTP mutations are rejected. Worker route declarations are parsed from literal Hono route calls; event reads and the Vision-only category-correction route are allowed, while create/update/move/cancel/delete event routes are rejected.

The command emits only pass/fail plus violation category and repository-relative path. Content, tokens, identifiers, and matched values are never printed.

## `safeFileIdentifier`

Normalizes a path relative to the project root and permits only a bounded ASCII path grammar with no parent segment or protected/secret fragment. Other names become a stable truncated SHA-256 identifier, preventing attacker-controlled filenames or control characters from entering CI output.

## `canonicalExpression`

Uses the TypeScript abstract syntax tree to resolve only string literals, no-substitution templates, template source forms, previously resolved identifiers, parenthesized/asserted values, bounded `+` concatenation, `toString()` on a resolved value, and `new URL()` around a resolved value. Every other expression stays unresolved and therefore fails closed at a provider or route boundary.

## `readHttpMethod`

Extracts a `method` property or shorthand only from an object literal and resolves it through the same bounded constant map. Spread-only, computed, dynamic, or absent methods remain unresolved.

## `staticMemberName`

Returns member names only for TypeScript property access or element access whose argument is a fixed string/no-substitution template. Dynamic computed members remain unresolved rather than being guessed.

## `isGoogleEventsExpression`

Recognizes `.events`, `["events"]`, and identifiers previously proven to alias that collection. This shared predicate lets direct calls, method aliases, object aliases, and object destructuring use the same SDK mutation boundary.

## `hasValidEvidenceProvenance`

Parses at most 1,000 nonempty JSON-lines records. Each record must declare evidence version 1, the exact expected surface, a canonical ISO capture time, the exact reviewed local-contract generator/run/source identity for that named fixture, and a structured record object. These are deterministic contract fixtures; live release captures and freshness are recorded separately by Recovery Task 4.

## `scanGoogleSource`

Builds a bounded static-value table across every production source file, detects direct and aliased Google event SDK mutations, recognizes provider calls from their resolved endpoint instead of a transport variable name, and checks the exact `(adapter file, endpoint pattern, HTTP method)` allowlist. The one reviewed `CalendarClient.request` transport forwarder is recognized structurally; all other unresolved calls in approved provider adapters fail closed.

## `scanRouteSource`

Builds static route-path values and discovers Hono receivers from parameter types, variable types, `new Hono`, reviewed `.basePath()` chains, and simple aliases. It composes base paths, parses direct verbs plus `.all`, `.on` method arrays, `.route`, and `.mount`, and permits only an exact file/method/path manifest for current mutating Phase B routes. All other mutating or unresolved Hono registrations are rejected, including routes whose names omit `events`.

## `resolveHonoReceiver`

Recursively resolves identifiers, direct `new Hono()` expressions, `.basePath()` calls, and chained Hono registrations. It returns only a boolean Hono proof plus an optional statically resolved base path; dynamic base paths remain unresolved and fail closed when used for mutation.

## `scanRelease`

Resolves a project root, validates required evidence directories, bounds each input to 16 MiB, rejects symbolic links, scans protected encodings and client secret-binding names, evaluates the Google call allowlist and Worker route manifest, sorts safe violations deterministically, and returns them without exposing matched content.
