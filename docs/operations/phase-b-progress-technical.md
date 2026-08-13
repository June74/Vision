# Phase B Progress — Technical Record

This page records implementation commits, verification evidence, review decisions, and unresolved technical notes. It is updated after each reviewed task.

## Current accepted status — 2026-08-12

- Phase B is complete and live-accepted. The accepted application commit is
  `5ec2887392d935751b591cc36248101b58071ee1`, with closure documentation at
  `0a1454144e55ffa3b303fcac9e4d2835a2ba6535`.
- Final evidence includes application, contract, Worker, workflow, TypeScript,
  documentation, production-build, browser, normal-deployment,
  calendar-maintenance-observer, and live-health checks. The privacy-safe
  references are collected in [`phase-b-evidence.md`](phase-b-evidence.md)
  and [`phase-c-handoff.md`](phase-c-handoff.md).
- Phase C is next. Its event-write pipeline must remain confirmation-based,
  version-aware, idempotent, reconciled after lost responses, audit-recorded,
  and verified against resulting Google state before success is shown.
- No Phase C application code, event-level Google write route, or provider
  mutation is introduced by this documentation reconciliation.

## Historical pre-closure status — 2026-08-07 (superseded)

- Phase B remains **in progress**; the authoritative gate map is
  [`docs/operations/phase-b-evidence.md`](phase-b-evidence.md).
- The current reviewed branch has a passing full local `pnpm check`, passing
  privacy-safe classifier/direct-launcher contracts, and no provider mutation
  in the latest repair cycle.
- OAuth/calendar setup, preview migrations, encrypted backup foundations, live
  schedule instrumentation, measured storage warnings, AI budget controls, and
  the preview fault harness are implemented. Required live acceptance,
  provider cleanup, final reviewed deployment, and the Phase C handoff remain
  open until fresh evidence closes them.
- The 2026-08-07 fresh-authorized attempt reached the baseline schedule
  challenge, consumed valid nonce-bound evidence, and entered candidate
  dispatch. The provider-facing deploy returned the allowlisted
  `candidate_deploy_resource_missing` category; the automatic rollback path
  returned `resource_missing`, so the safe result was
  `rollback_outcome_uncertain` with `rollback_verified: false`.
- Read-only deployment and version reconciliation decoded successfully and
  found no candidate or rollback marker; the existing preview health contract
  remained exact and healthy. The local artifacts and configured R2/Queue
  resources were present. The raw provider text was not retained.
- This single approval is consumed. Phase B must not retry deployment until a
  provider-side deploy-capability/resource cause is reconciled and a new exact
  owner approval is supplied.
- The next diagnostic checkpoint is owner-scoped and read-only: confirm that
  the identity used by the saved Wrangler OAuth session has Worker deployment
  edit access for the preview Worker and access to the existing preview R2 and
  Queue resources. A permission change, token rotation, re-login, or provider
  resource mutation requires separate explicit approval; no secret value is
  requested or recorded.
- Owner confirmation has been received for that access checkpoint. The prior
  mutation approval remains consumed; a fresh exact approval is required for
  any new monitored candidate retry.
- A second fresh baseline-confirmed attempt after that owner confirmation
  reproduced `candidate_deploy_resource_missing`, followed by
  `resource_missing` during rollback. Read-only deployment/version listings
  again found no candidate or rollback marker, and preview health remained the
  exact HTTP 200 contract. A bounded `wrangler whoami --json` probe exited and
  decoded successfully, with Worker/edit and Queue-related metadata but no R2
  text; this does not prove or disprove R2 permission and no raw identity data
  was retained.
- The next diagnostic is therefore owner-scoped and read-only: inspect R2
  access for the same saved Wrangler identity and review preview Worker
  provider activity. Do not change provider state. Any future mutation needs a
  fresh exact approval.
- If the identity check is already satisfied, inspect the preview Worker's
  **Settings → Bindings** and **Deployments/Activity** views read-only. Confirm
  that the existing R2 and Queue bindings are attached and whether the latest
  attempt has a failed deployment entry. Record only generic categories; do not
  copy identifiers or provider payloads.
- The owner clarified that both the preview R2 bucket and Queue exist. The
  earlier generic “binding missing” report therefore does not confirm a binding
  mismatch. The provider-side cause remains unresolved; no binding change is
  authorized.
- The owner reported no failed deployment entry in Cloudflare Deployments or
  Activity. The safe interpretation is a pre-version provider rejection. The
  next read-only diagnostic is the saved Wrangler account/context and Worker
  version/deploy capability; no account, token, resource, or Worker setting
  change is requested.
- The bounded `wrangler whoami --json` result decoded but exposed no permission
  names, so it cannot confirm or deny the required Worker Scripts Write scope.
  The same Cloudflare member role must be inspected read-only; no token
  creation, rotation, or permission mutation is requested.
- Owner confirmation says the Wrangler identity has all privileges, making a
  simple role shortage unlikely. The next read-only diagnostic is the existing
  deployed-version shape and exact account/Worker context.
- Root and artifact-local Wrangler binaries report the same version. The
  candidate artifact's exact deploy invocation also passed a compile-only
  dry-run with no stderr, so local CLI/config drift is ruled out; the remaining
  failure is in live provider upload/context.
- The current deployed version list/detail also succeeds in the same Wrangler
  context; its safe shape contains metadata/resources and both expected R2 and
  Queue binding names. This makes the live upload rejection pre-version and
  context-specific rather than an existing binding absence.
- Owner privileges do not prove that the saved Wrangler OAuth grant selected
  the same account and scopes. The next manual diagnostic is an interactive
  Wrangler re-authentication followed by read-only identity/version checks;
  deployment remains separately gated by fresh approval.
- Reauthentication and post-reauth identity/version list/detail checks passed,
  including both expected R2/Queue references. The next step is one fresh
  monitored candidate upload/rollback attempt, which requires a new exact
  owner approval.
- That third fresh approved attempt reproduced the same pre-version resource
  missing/rollback uncertainty. Final read-only deployment/version lists had
  ten rows each with no candidate/rollback markers, and preview health remained
  HTTP 200 with the exact contract. Further mutation is blocked pending a
  Cloudflare-side diagnostic or explicitly approved provider-state change.
- A compile-only Wrangler dry-run of the exact candidate artifact, including
  the controller's tag/message flags, then exited zero with bounded output, no
  stderr, and a temporary output directory. The
  safe failure category is `none`; this independently confirms local
  bundling/config validity and leaves the resource-missing boundary at live
  provider dispatch. No deployment occurred.
- The controller's local schedule-evidence wait was aligned from 180 seconds
  to the existing 600-second freshness bound. A test-first wait contract was
  RED then GREEN, and all 13 provider-free controller/launcher safety scripts
  passed. This repair changes no provider state and still requires a new exact
  approval before a future live attempt.
- A fresh owner dashboard check confirmed the Queue and R2 binding pairs match
  the expected preview resources, while both Deployments and account Audit Logs
  contain no failed attempt. The pinned candidate and rollback commit configs
  independently contain the same preview binding names and environment.
- Because the controller intentionally classifies only bounded allowlisted
  signatures, `resource_missing` currently means that a broad `not found` or
  equivalent signature matched; it does not prove which provider object was
  absent. No raw provider output is retained. The required next diagnostic
  change was limited to an allowlisted fingerprint (matched category and source
  channel), followed by a new exact approval before any live retry.
- The diagnostic fingerprint change is now implemented and test-first
  verified. `Invoke-NativeBounded` returns only an allowlisted signature and
  source channel alongside the existing category; the controller propagates
  those fields as `candidate_failure_signature/source` and
  `rollback_failure_signature/source`. Fifteen provider-free controller
  contracts and documentation coverage pass. No provider request occurred, and
  the subsequent live retry remained separately gated by fresh approval.
- The fresh approved fingerprinted attempt completed with
  `candidate_failure_signature: not_found` and
  `candidate_failure_source: temporary_log`; rollback produced the same safe
  fingerprint. Candidate acceptance and rollback verification both remained
  false. Corrected read-only reconciliation decoded ten deployment rows and ten
  version rows with zero candidate/rollback markers; preview health returned the
  exact HTTP 200 contract. The remaining failure is a generic provider
  not-found response whose object is not identified by the privacy-safe
  boundary, so further mutation is blocked pending external provider evidence
  or an explicitly approved provider-state change.
- Local inspection of the attempt's retained logs found only the safe controller
  envelope (stderr was empty); the temporary Wrangler log was cleaned up, so a
  raw 404/auth/network message cannot be recovered from that run. The root and
  reviewed preview configurations contain the exact Queue and R2 names already
  confirmed in the dashboard. The unqualified root `wrangler deploy --verbose`
  command is not a valid preview diagnostic because the root configuration is
  the local environment and has no preview R2 attachment.
- Cloudflare's public status page listed R2 as operational when checked on
  2026-08-10. The ENAM R2 availability incident posted at 18:42 UTC on
  2026-08-07 overlaps the failed attempt near 20:56 UTC and remains the first
  credible external correlation, but bucket-specific impact is not proven. One
  fresh controlled retry was authorized after resolution and stopped before
  upload at the schedule-evidence gate; a future retry still requires fresh
  exact approval and timely nonce-bound evidence.
- The newest foundation observer retry created one valid, active listener and
  skipped every mutation job, but the local controller failed closed before
  `observer_ready`. Safe reconciliation proved exact run identity, active
  topology, correlation-artifact presence, and ample API quota; replaying the
  same snapshots through the resolver succeeded. The failure is classified as a
  transient provider-process metadata read/timing race. The concrete adapter
  now retries one early settled child failure for 250 ms within the existing
  absolute deadline; timeout, cancellation, output-bound, parse, and projection
  failures remain fail-closed. Local unit (1,760 passed, 6 skipped), type,
  contract, Worker, documentation, build, deploy-check, and security gates pass.
  The live candidate/rollback proof is still open.
- Historical task entries below retain their original implementation notes;
  they do not override the current gate map or release decision.

## Runtime Task 1 — Application foundation

- Status: complete and independently approved.
- Commit range: `5cdf217..4cd7aaa`.
- Implementation commit: `4cd7aaa build: scaffold Vision Worker application`.
- RED evidence: `tests/unit/server/env.test.ts` failed because `src/server/env.ts` did not exist.
- GREEN evidence: focused Vitest contract passed, strict TypeScript check exited `0`, and the Vite/Cloudflare production build exited `0`.
- API contract: `GET /api/health` returns `{ "status": "ok", "service": "vision" }`.
- Documentation contract: mirrored simple and technical references exist for every production file introduced by the task, with folder guides and source JSDoc.
- External state: no Cloudflare, Google, Neon, OpenAI, or other live resource was created or changed.
- Review result: spec compliant; code quality approved; zero Critical, Important, or Minor findings.

### Carried technical note

Cloudflare's Vite plugin is active for production builds but omitted in Node-only test mode because the current plugin rejects Vitest's Node external-resolution configuration. Runtime Task 2 must test the Worker through `@cloudflare/vitest-pool-workers`; this note closes only after that test path passes.

## Runtime Task 2 — Documentation and runtime verification

- Status: complete and independently approved.
- Commit range: `4090290..20e2f8e`.
- Implementation/fix commits: `9739ed3`, `a084cd1`, `fd08aa6`, and `20e2f8e`.
- Test evidence: documentation validator 6/6 focused cases, unit suite 2/2, Worker pool 1/1, Chromium 1/1, strict application/test type checks, documentation check, production build, and diff check all passed.
- Documentation validator: enforces mirrored file/function references, nested folder guides, module documentation, and named function/component/method JSDoc while excluding fixtures, migrations, tests, generated declarations, and conventional configuration files.
- Runtime evidence: `SELF.fetch` verifies the exact health API in the workerd-compatible pool; Playwright verifies rendered `Vision` and `Foundation status` text in Chromium.
- Dependency decision: TypeScript is pinned to stable `5.9.3` because the installed `7.0.2` package did not expose the compiler API required by the validator.
- Review result: final spec compliance and task quality approved; zero remaining findings.

## Runtime Task 4 — Guarded delivery pipeline

- Status: complete and independently approved; hosted acceptance passed.
- Commit range: `dd58f7c..6b5d0ba`.
- Implementation/fix commits: `28e7027` and `6b5d0ba`.
- Test evidence: frozen install, focused workflow policy 1/1, `pnpm check` with 17 unit and 4 Worker tests, Chromium 1/1, standalone build, PyYAML parse, and diff checks passed.
- CI: pull-request-only least-permission verification with frozen pnpm install, full check, and browser smoke.
- Preview/production: verify resolves an immutable SHA and deploy checks out that exact SHA; missing preview token fails explicitly; production requires `DEPLOY VISION PRODUCTION` and references the `production` environment.
- Review result: repository spec compliance approved; no Critical or Important findings remain.
- Carried Minor: official GitHub Action references use mutable major tags until verified commit provenance is recorded.

### External acceptance state

- GitHub CLI is authenticated as June74.
- Cloudflare Wrangler was authenticated manually by the user.
- The reviewed preview candidate was deployed as `vision-preview` at `https://vision-preview.june74.workers.dev`.
- Hosted health acceptance: `GET /api/health` returned HTTP `200` with exact body `{ "status": "ok", "service": "vision" }`.
- Hosted browser acceptance: the rendered page title was `Vision`, with exactly one `Vision` heading and one `Foundation status` label.
- GitHub production required reviewers, no-bypass, branch policy, environment-only secret scope, and required `Check` status remain unconfigured release prerequisites.
- No production deployment or GitHub deployment workflow has run.

### Closed technical note

The Task 1 test-host concern is closed: Node unit tests remain isolated from the Cloudflare Vite plugin, while Worker behavior is now tested separately through `@cloudflare/vitest-pool-workers` and production builds retain the Cloudflare plugin.

### Environment note

Codex's restricted sandbox blocks Wrangler's normal AppData cache/log paths. The same Worker, browser, and build commands pass cleanly with the required filesystem approval; no production configuration was weakened to suppress the sandbox behavior.

## Runtime Task 3 — Privacy-safe server envelopes

- Status: complete and independently approved.
- Commit range: `7aa596b..1395673`.
- Implementation/fix commits: `63eaa84` and `1395673`.
- Test evidence: focused logger/error suite 12/12; full `pnpm check` reported 16 unit and 4 Worker tests; Chromium 1/1, docs, type checks, production build, and diff check passed.
- Log boundary: accepts plain records only, inspects all own keys with `Reflect.ownKeys`, rejects symbols/non-enumerable/unsupported keys, and constrains entity IDs to UUIDs.
- Error boundary: public `VisionError` has exactly `code`, `status`, and `safeMessage`; an unexported `Error` carrier transports it through Hono without widening the public contract.
- Reliability: audit-sink failure is caught only inside the response-preservation path, so the required error envelope still returns while normal logger validation remains fail-fast.
- Routing: unknown `/api/*` paths return safe JSON; `/api/health` remains exact; non-API paths retain the asset fallback.
- Review result: final spec compliance and task quality approved; zero remaining findings.

## Domain Task 1 — Canonical domain contracts

- Status: complete and independently approved after one fix round.
- Commit range: `e18c315..8b08252`.
- Implementation/fix commits: `525e726` and `8b08252`.
- RED evidence: initial imports failed with both domain modules absent; the fix round then produced five expected failures for missing/partial identity and contradictory domain-state pairs.
- GREEN evidence: focused domain suite 17/17; pure-domain dependency scan clean; typecheck and documentation checks passed; full check passed with 34 unit and 4 Worker tests plus production build.
- Category rule: explicit user choice, confirmed source association, AI inference, then unresolved.
- Privacy rule: inference cannot lower privacy and never authorizes sharing.
- Canonical identity: strict provider, Vision first-party, or Vision system identity is mandatory; absent and partial identities are rejected.
- State invariant: `unresolved` pairs only with `unresolved`; concrete domains pair only with `confirmed` or `inferred`.
- Review result: initial review found two Important contract gaps and one Minor test gap; the re-review approved spec compliance and task quality with zero remaining findings.

## Domain Task 2 — PostgreSQL schema and repository boundary

- Status: complete; final independent acceptance approved with zero Critical, Important, or Minor findings.
- Commit range: `6e89a29..5f0a03e`.
- Implementation/fix commits: `51e7ddc`, `1ccaf62`, `86685c8`, `c863efa`, and `5f0a03e`.
- RED evidence: missing migration contract failed with `ENOENT`; subsequent repair rounds captured unsafe owner/upsert, privileged-role, incomplete-drift, and stale preflight concurrency failures.
- GREEN evidence: focused factory/environment/repository/schema suite 17/17; complete structural comparator 5/5; full check 38 unit and 4 Worker tests; typecheck, documentation, production builds, generated/reviewed migration diffs, and diff hygiene passed.
- Schema authority: reviewed `0001_phase_b_foundation.sql` covers eight tables; a migration-derived normalized manifest independently compares every column/type, key, foreign-key endpoint, and check expression against live Drizzle metadata and the retained generated snapshot.
- Protected storage: provider identities and sync tokens are scalar/binary rather than JSON; protected payload columns are `bytea`.
- Credential boundary: `createDb(databaseUrl)` validates internally and accepts only the dedicated `vision_app` role without echoing rejected secrets.
- Repository boundary: one-statement CTE upserts preserve owner/stable identity, enforce monotonic versions, return truthful `applied`/`no_newer_version` outcomes, and translate PostgreSQL uniqueness races into privacy-safe typed conflicts.
- Data minimization: provider event lookup projects planning-safe columns only and never selects protected ciphertext envelopes.
- External state: no live Neon database, role, migration apply, or concurrent-load test has run; those remain milestone acceptance work.
- Review result: early reviews exposed three Critical and multiple Important gaps; all were repaired. Final acceptance approved both spec compliance and task quality with zero findings.

## Domain Task 3 — Protected-field cryptography

- Status: complete; final independent acceptance approved with zero Critical, Important, or Minor findings.
- Commit range: `4d75aa0..3aaa982`.
- Implementation/fix commits: `7e81886`, `543b92b`, and `3aaa982`.
- RED evidence: absent crypto modules and undersized root-secret acceptance failed initially; security review fixes then reproduced test-provider reachability, rotation overlap mismatch, stale reconstruction, incomplete base64url acceptance, unbounded inputs, and uncleared validation-buffer paths.
- GREEN evidence: focused crypto/environment suite 36/36; full check 71 unit and 4 Worker tests; typecheck, documentation, Worker/client builds, production-boundary validator, bundle scan, secret/plaintext scan, and diff checks passed.
- Cipher contract: Web Crypto AES-256-GCM, fresh 96-bit IV, explicit 128-bit tag, strict `v1/A256GCM` envelope, canonical base64url JSON boundary, and AAD binding owner/node/field/key version.
- Key contract: per-owner/domain/version non-extractable data keys, root-wrapped records only, atomic `putIfAbsent`, persisted monotonic active-version high-water mark, exact historical lookup, and linearizable rotation snapshots.
- Production boundary: no fixed test root exists; source-import validation and post-build Worker bundle scanning reject the test provider from production artifacts.
- Admission boundary: 64 KiB protected plaintext limit plus pre-JSON/pre-base64 bounds for envelopes, ciphertext, IVs, and wrapped keys.
- Secret hygiene: root-secret parsing accepts the full canonical 256-bit base64url space, uses constant errors, and clears application-controlled decoded buffers in `finally`.
- External state: no live root key, durable wrapped-key store, database adapter, or deployed crypto wiring was created; the future durable store must implement the reviewed atomic contracts.
- Review result: initial review found two Critical and three Important issues; all fixes and the final Minor buffer cleanup passed final re-review with zero findings.

## Domain Task 4 — Encrypted event persistence and privacy-safe audit

- Status: complete; final independent acceptance approved with zero Critical, Important, or Minor findings.
- Commit range: `cf89ca3..0b06602`.
- Implementation/fix commits: `e2c345b`, `83719a3`, `a092d86`, and `0b06602`.
- RED evidence: initial missing persistence behavior failed; final repair reproduced two remaining contract failures for concurrent node-lock ordering and the exact provider-order-key documentation.
- GREEN evidence: focused event/graph/PGlite suite 22/22; graph/schema contracts 13/13; full check 100 main tests and 4 Worker tests; typecheck, documentation, builds, production-boundary checks, source/bundle scans, and diff checks passed.
- Persistence boundary: protected event fields are encrypted before storage; planning projections exclude envelope columns; authorized protected reads re-check owner, privacy, domain, node, and version before decryption.
- PostgreSQL adapter: strict Neon raw-result decoding, exact owner/node fact matching, monotonic exact 20-digit provider order keys, deterministic equal-version replay/conflict behavior, and a fresh winner query after empty conflict results.
- Concurrency: the exact eligible node row is selected `FOR UPDATE OF node`, preventing a concurrent node-fact update from interleaving with the event statement; later node reclassification must coordinate event re-encryption.
- Authorization boundary: repository construction and protected reads require private identity-registered decisions rather than caller-asserted owner/privacy objects.
- Envelope compatibility: new writes use domain-bound v2 AAD while fixed legacy vectors preserve v1 decryption compatibility.
- Audit boundary: durable audit persistence copies only own allowlisted data properties to a null-prototype record and rejects nested, inherited, accessor, hidden, symbol, or protected content.
- External state: no live Neon request or real two-session Neon/PostgreSQL race was executed; those remain milestone acceptance gates.
- Review result: all initial Critical/Important findings and the final row-lock/documentation findings were repaired; final spec compliance and task quality are approved with zero findings.

## Domain Task 5 — Recoverable deletion and permanent purge

- Status: complete; final independent acceptance approved with zero Critical, Important, or Minor findings.
- Commit range: `45b2156..b89252f`.
- Implementation/fix commits: `396ad5b`, `334353e`, and `b89252f`.
- RED evidence: initial lifecycle imports were absent; review fixes then reproduced owner-boundary, exact-deadline, concurrency, constructor-reachability, and complete audit-conflict failures before implementation.
- GREEN evidence: final focused suite 18/18; unit lifecycle/authorization suite 74/74; contract/integration suite 41/41; full check 121 main tests and 4 Worker tests; typecheck, documentation, builds, production source/bundle reachability guards, crypto-boundary scans, and diff checks passed.
- Time contract: deletion confirmation uses a UTC instant; `purgeAfter` is exactly `30 * 24` hours later; restoration requires `now < purgeAfter`; purge is due when `now >= purgeAfter`.
- Restore boundary: owner-scoped restoration locks and revalidates the node and recovery rows, preserves protected content, rejects deadline equality, and has deterministic retry behavior.
- Purge boundary: a private system-authorized repository claims rows in deterministic order, revalidates eligibility, removes ciphertext/event rows, related edges, and recovery rows transactionally, and is idempotent across workers.
- Audit integrity: purge audit identity is deletion-episode-specific; every collision aborts the atomic statement, so deletion cannot succeed without inserting the complete required privacy-safe audit fact.
- Authorization integrity: concrete owner and purge implementations are module-private, capabilities are identity-registered and rechecked, test/internal issuers are absent from production exports, and source/bundle guards reject production reachability.
- Documentation: simple and technical mirrors cover lifecycle, repository, job, and authorization modules, including dependencies, inputs/outputs, side effects, failures, privacy, authority, and covering tests.
- External state: no isolated Neon migration, checksum capture, least-privilege query, raw sentinel scan, or true multi-session PostgreSQL/Neon race was executed; these remain milestone acceptance gates.
- Review result: three Important and two Minor initial findings plus two remaining Important re-review findings were repaired; final spec compliance and task quality are approved with zero findings.

## Authentication Task 1 - Identity and calendar-setup state machines

- Status: complete; independent review approved spec compliance and task quality with zero Critical or Important findings and two carried Minors.
- Commit range: `2fbc6ab..37330d2`.
- Implementation/fix commits: `0ccc746`, `97f12fa`, `2794343`, and `37330d2`.
- GREEN evidence: focused identity/setup suite 34/34; full check 155 main tests and 4 Worker tests; documentation, typechecks, pure-domain checks, and production build passed.
- Identity boundary: exact scalar audience, trusted issuer, expiration, subject, verified email, exact allowlisted subject, and normalized allowlisted email; failures use constant safe errors.
- Input boundary: claims, allowlists, setup states, commands, and nested calendar-ID collections are descriptor-snapshotted before use to prevent accessor/proxy error leakage and mutation races.
- Setup boundary: all eight required states, exact creation confirmation, explicit existing-calendar selection, exact current-version checks, deterministic increments, and overflow rejection.
- Carried Minors: remove stale references to deleted snapshot helpers; align `snapshotCalendarIds` documentation with non-enumerable-index behavior and document or replace its 10,000-ID bound.
- External state: no Google token, allowlist secret, session store, provider call, or setup persistence was created or contacted.

## Authentication Task 2 — Server-side Google OAuth and sessions

- Status: complete; independent review approved spec compliance and task quality with zero Critical or Important findings and one carried Minor.
- Commit range: `2c58fcd..274246a`.
- Implementation/fix commits: `76b37d4` and `274246a`.
- GREEN evidence: focused auth suite 43/43; full check 179 main tests and 15 Worker tests; documentation, typechecks, builds, crypto boundary, security scans, plaintext/secret scans, and diff checks passed.
- OAuth boundary: authorization-code flow with PKCE S256, high-entropy state and nonce, exact redirect URI, single-use short-lived server records, offline access, and narrow discovery/create/read-only Calendar scopes.
- Identity boundary: injected cryptographic token-verification port followed by trusted issuer, scalar audience, nonce, expiration, subject, verified email, and Task 1 allowlist validation.
- Token boundary: retained refresh/access tokens use protected-field encryption; database-side atomic preservation prevents an omitted refresh token from overwriting a newly issued value; equal retries preserve ciphertext/version.
- Admission boundary: server-derived HKDF-separated admission keys, atomic fixed-window/outstanding limits, privacy-safe 429 responses, expiry cleanup, physical consumed-row deletion, and supporting indexes.
- Session boundary: opaque rotated server sessions, narrow HttpOnly cookies, Secure outside local, SameSite=Lax, logout invalidation, and CSRF protection for authenticated mutations.
- Carried Minor: repair the hostile session-binary regression fixture so required admission fields are present and the test demonstrably reaches the byte decoder.
- External state: no live Google OAuth/JWKS, Neon role/database, Cloudflare metadata, deployed cookie/header behavior, or external telemetry was exercised.

## Authentication Task 3 - Calendar discovery and idempotent setup APIs

- Status: complete; independent review approved spec compliance and task quality with zero Critical or Important findings and one carried Minor.
- Commit range: `e40cce6..b1e0a66`.
- GREEN evidence: focused suite 38/38; full check 193 unit/integration and 30 Worker tests; typechecks, docs, builds, crypto validation, event-write, secret/plaintext, adapter-boundary, and diff scans passed.
- Candidate boundary: stable nonempty, non-primary, non-deleted calendars named exactly `Vision` with owner access and verified account evidence are eligible.
- Creation boundary: exact setup version, confirmation, UUID idempotency key, atomic owner-scoped ledger and pre-create ID snapshot; exact summary/timezone body.
- Liveness boundary: bounded provider headers/streams, safe cancellation, and 120-second owner/key/version-bound takeover for abandoned operations.
- CSRF/state boundary: GET is read-only; discovery mutations use CSRF-protected POST and owner/version CAS.
- Event boundary: no event insert/update/delete API or provider method is reachable.
- Carried Minor: a takeover CAS loser may return a transient generic error instead of reloading the concurrent durable winner; no duplicate creation is possible.
- External state: no live Google, Neon, or Cloudflare execution was performed.

## Authentication preview remediation - 2026-07-24

- Status: the approved-account authentication and calendar-setup happy path passes in the deployed preview; the complete Plan 3 milestone remains in progress.
- Root causes covered by the saved fix: Google returns benign baseline `profile` identity scopes alongside the requested grant; Neon returns UTC `timestamptz` text ending in `+00`; Cloudflare provider adapters require the runtime's global `fetch` to retain its receiver; timestamp validation must reject component rollover before JavaScript can normalize it.
- RED evidence: six focused regressions failed against pre-fix commit `7f57430` for profile-scope acceptance, Google-token `+00` timestamps, connected-calendar `+00` timestamps, OAuth token-exchange fetch binding, JWKS fetch binding, and Calendar API fetch binding. The first strict timestamp test also caught the intermediate date-only `-23` suffix ambiguity before commit.
- GREEN evidence: the focused compatibility and strictness suite passed 21/21 against the saved fix. The fresh full verification passed 196 unit/integration tests, 44 contract tests, 32 Worker tests, and 10 Chromium setup flows, plus strict type checks, documentation validation, the production build, and the production crypto-boundary validator.
- CI regression gate: `pnpm check` now includes the contract project; previously the standard check omitted the project containing the Google/Neon compatibility regressions.
- Hosted evidence: a fresh approved-account Google sign-in reached `Connected` at setup version 4, verified a new secondary Vision calendar with zero events, and remained connected after a full reload.
- Privacy evidence: no callback URL, authorization code, token, database URL, key, full calendar ID, account identifier, or OAuth secret was recorded.
- Deployment-attribution note: the live client asset names match the local production build, but the server deployment was made from uncommitted working-tree changes. Commit and deployment identity must be reconciled before this milestone can be treated as immutable release evidence.
- Remaining Plan 3 evidence: wrong-account denial, exact-confirmation enforcement, raw encrypted-token inspection, logout/revocation behavior, disposable-calendar cleanup, and a reviewed commit whose local, remote, and deployed identities are attributable.

## Current live-acceptance checkpoint — 2026-08-10

A fresh approved `deploy_candidate` controller run was launched after the
Cloudflare R2 incident was resolved. Fresh nonce-bound baseline evidence passed
after owner schedule confirmation, and the controller reached the live upload
boundary. The safe result was `candidate_deploy_resource_missing` with a
`not_found` temporary-log signature, followed by
`rollback_outcome_uncertain`/`resource_missing`; `rolled_back: false` and
`rollback_verified: false`. No candidate or rollback version marker appeared.
A bounded read-only deployments-list reconciliation then exited zero and
decoded ten existing records with no candidate or rollback marker. This is the
fourth reproduction, including one after R2 was operational; no further
automatic retry is safe without a Cloudflare-side diagnostic or an explicitly
approved provider-state change. Owner dashboard evidence independently
confirms the active deployment, both binding/resource pairs, and no missing
resource; the unresolved boundary is therefore the provider's pre-version
upload lookup or upload-side metadata path.
