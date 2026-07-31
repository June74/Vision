# `src/server/api/diagnostic-routes.ts`

This module registers authenticated no-store HTTP surfaces for foundation status, synchronized event display, deterministic template availability, and Vision-only category correction. Every response is constructed from an explicit allowlist.

## `registerDiagnosticRoutes`

Registers `GET /api/diagnostics/status`, `GET /api/calendar/events`, `GET /api/diagnostics/templates`, and `PATCH /api/calendar/events/:id/category` before the generic API fallback. The PATCH route authenticates and verifies CSRF before body parsing.
Status admits the complete generated selector and AI-attestation pair, then
applies a synthetic health overlay only when the selector belongs to the
frozen six-fault tuple. Dedicated foundation and AI evidence candidates retain
normal diagnostics.
After session and owner admission, preview status constructs an owner-bound AI
usage source. Every preview response reads the owner-wide active aggregate.
Only `ai_usage` performs the single candidate-window aggregate read and
returns created and eligible counts with the parsed canonical evidence minute.
The response explicitly copies only those four aggregate fields; production
omits the temporary `aiAcceptance` member and performs no aggregate read.

## `createProductionDiagnosticDependencies`

Builds encrypted auth dependencies, a least-privileged database client, the wrapped-key provider, and an approved-owner repository factory. Database/R2 capacity telemetry remains false until the release-monitoring task wires measured warnings.

## `now`

Returns a fresh `Date`. Status uses one shared observation instant for repository month selection and health freshness, preventing threshold drift within one response.

## `repositoryForOwner`

Rejects any owner different from the OAuth-derived private-pilot owner and creates the owner-bound repository.

## `aiUsageSourceForOwner`

Runs only after authentication and owner admission. It repeats the approved
owner check and exposes only `countActiveRequests` and
`readCandidateRequestCounts`, preventing request-level rows or provider data
from crossing into the route.

## `authenticateDiagnosticRequest`

Hashes and resolves the opaque cookie through encrypted session persistence before repository construction or request-body access.

## `requireDiagnosticCsrf`

Uses the shared digest verifier to compare the supplied header with the decrypted session token.

## `readBoundedJson`

Requires JSON content type, rejects an oversized declared length, independently streams no more than 1,024 bytes, decodes fatal UTF-8, and maps malformed input to one safe 400.

## `toSafeDiagnosticEvent`

Copies exactly ID, title, schedule, status, domain, domain state, and category provenance. Accidental ciphertext, key, owner, provider, or internal fields on an injected object are discarded.

## `resolveRouteDependencies`

Maps database/configuration/key initialization rejection to the constant diagnostic availability error.

## `invalidCategoryCorrection`

Creates `INVALID_CATEGORY_CORRECTION` without echoing the event ID or body.

## `diagnosticsUnavailable`

Creates `DIAGNOSTICS_UNAVAILABLE` without retaining database, encryption, provider, or identity detail.

## Covering tests

`tests/worker/diagnostics.test.ts` covers session/CSRF boundaries,
owner-before-aggregate ordering, preview-only aggregate shapes, candidate query
isolation, response redaction, single-time freshness, explicit correction,
template availability, and the real exact-950 Worker survival contract with
zero context/provider calls. `tests/e2e/foundation-diagnostics.spec.ts` covers
the aggregate-only deployed response shape without a production UI control.
