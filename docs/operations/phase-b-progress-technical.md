# Phase B Progress — Technical Record

This page records implementation commits, verification evidence, review decisions, and unresolved technical notes. It is updated after each reviewed task.

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
