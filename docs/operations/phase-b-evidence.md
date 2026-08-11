# Phase B completion evidence

**Status:** In progress
**Branch:** `codex/phase-b-foundation`
**Environment:** Local clean checks plus live preview
**Evidence rule:** A gate remains pending until its required live exercise has
fresh evidence.

This file contains no credentials, database URLs, OAuth codes, tokens,
encryption keys, emails, protected calendar content, object keys, branch
identifiers, or provider-controlled URLs.

## Completion-gate map

| Phase B gate | Automated evidence | Live evidence | Status |
|---|---|---|---|
| Google access restricted to the approved private owner | `tests/contract/google/oauth.contract.test.ts`, `tests/integration/data/auth-admission.test.ts`, `tests/worker/auth.test.ts` | Real OAuth admission and session persistence succeeded; a fresh wrong-account denial still needs capture | Pending |
| Vision calendar created or connected only after confirmation | `tests/unit/domain/calendar-setup.test.ts`, `tests/contract/google/calendar-setup.contract.test.ts`, `tests/worker/calendar-setup.test.ts`, `tests/e2e/auth-setup.spec.ts` | Real secondary calendar connected and verified with zero events | Pass |
| Normal calendar changes synchronize near real time | `tests/contract/google/incremental-sync.contract.test.ts`, `tests/integration/jobs/sync-calendar.test.ts`, `tests/integration/jobs/sync-repository.test.ts` | Disposable Vision-calendar event appeared in the authenticated desk after a successful Google webhook/Queue handoff; deletion propagated through the same path and the final desk read showed it gone | Pass |
| Deliberately missed notification is repaired | `tests/integration/jobs/repair-sync.test.ts` | Fresh missed-signal repair exercise required | Pending |
| PostgreSQL preserves identity, category, privacy, provenance, and governed relationships | `tests/contract/data/graph-repository.contract.test.ts`, `tests/unit/domain/identity.test.ts`, `tests/unit/domain/category.test.ts`, `tests/unit/domain/graph.test.ts`, repository integration suites | Live preview schema and synchronized-row aggregate checks required | Pending |
| Protected content absent from raw storage and logs | `pnpm security:scan`, `tests/security/protected-sentinel.test.ts`, release evidence fixtures | Live raw-row, safe-log, and encrypted-object sentinel checks required | Pending |
| Duplicate, stale, revoked-access, invalid-token, and uncertain-outcome cases pass | Queue, synchronization, OAuth, and concurrency unit/integration/contract suites | Revoked authorization requires a fresh live exercise; the rest have current automated evidence | Pending |
| Encrypted backup restore succeeds | Backup round-trip, daily-job, retention, corruption, and restore-guard suites | See `restore-drill.md` | In progress |
| Operational state accurately exposes delayed, failed, action-required, and disconnected conditions | `tests/unit/domain/health.test.ts`, `tests/worker/diagnostics.test.ts`, `tests/e2e/foundation-diagnostics.spec.ts` | Fresh live failure exercises required | Pending |
| Measured usage remains compatible with approximately $20/month | Deterministic 800/900/950-cent AI budget tests | See `cost-review.md`; live OpenAI/Gateway evidence remains | In progress |
| No event-level Google write is enabled | `tests/security/google-write-surface.test.ts`, `pnpm security:scan` | Generated preview artifact and live route/UI inspection show no event mutation controls | Pass |

## Current verification record

| Timestamp UTC | Commit | Environment | Verification | Result |
|---|---|---|---|---|
| 2026-07-26 | `066fcbd` | Local | `pnpm check` | Pass: 610 unit/integration passed, 1 skipped; 179 contract passed; 75 Worker passed; docs, build, and security scan passed |
| 2026-07-26 | `066fcbd` | Guarded preview workflow | Application checks, browser smoke, generated configuration validation, deploy | Pass |
| 2026-07-26 | `066fcbd` | Live preview | Health endpoint and unauthenticated application shell | HTTP 200 and expected safe UI |
| 2026-07-26 | `3935500` | Local | `pnpm test:e2e` | Pass: 29 browser tests |
| 2026-07-26 | `3935500` | Live preview | Temporary every-minute recovery trigger | Failed closed: no object; read-only schema check confirmed 11 required tables and nine migration signature columns absent |
| 2026-07-26 | `67af8e8` | Guarded preview workflow and live trigger settings | Restore normal daily recovery cadence | Pass: guarded workflow succeeded; `5 6 * * *` and maintenance cadence present; temporary every-minute trigger absent |
| 2026-07-26 | `9f5a0d5` plus local preflight | Disposable local PostgreSQL-compatible database | Apply migrations 0004-0009 atomically, force a rollback, and verify direct privileges | Pass: zero missing required tables, zero missing signature columns, forced rollback removed migration-0004 tables, expected `vision_app` grants matched on 13 tables, and `PUBLIC` had zero affected-table grants |
| 2026-07-26 | `9620e06` | Local | Updated application and release gates | Pass: 611 unit/integration/security tests with one intentional skip; 179 contract; 75 Worker; 29 browser; TypeScript, docs, production build, release security scan, and diff checks passed |
| 2026-07-26 | `6a14659` plus authorized live operation | Preview Neon | Apply reviewed migrations 0004-0009 as one transaction and verify post-0009 signature | Pass: staged transaction matched the reviewed source by exact character count and SHA-256; all eleven required tables and all nine required columns were present afterward |
| 2026-07-26 | `ffb3c0a` plus authenticated provider inspection | Preview Worker and private R2 | Run post-migration scheduled backup and verify safe stored-object facts | Pass: safe tail returned no failure, exactly one current-date encrypted object was present, and format, key version, date, and ciphertext-digest shape matched the contract |
| 2026-07-26 | `d7da15d` | Guarded preview workflow and live trigger settings | Restore normal daily recovery cadence after backup acceptance | Pass: complete checks and browser smoke passed; `5 6 * * *` and maintenance cadence are deployed; the temporary every-minute trigger is absent |
| 2026-07-26 | Authorized live operation | Disposable schema-only Neon branch | Create isolated restore target and provision database-owned migration-9 attestation | Pass: one additional branch is listed, and an independent assertion query completed successfully without exposing the branch identifier |
| 2026-07-27 | `a433912` | Guarded preview operator workflow | Verify the saved global AI Gateway budget using read-only detail inspection | Historical pass: exactly one enabled, unscoped $9.50 fixed 30-day cost rule matched; current freshness requires re-verification after contradictory 2026-08-03 UI signals |
| 2026-08-03 | Candidate `c1911f8` not deployed | Direct owner Cloudflare dashboard interaction plus local contract audit | Reconcile live Gateway existence with the tracked budget evidence | Inconclusive and failed closed: the first viewed surface did not reveal a Gateway, while exact-name creation was then rejected as a duplicate; no mutation occurred and fresh read-only identity/rule verification is required before candidate deployment |
| 2026-08-03 | Candidate `c1911f8` not deployed | Owner-run corrected controller plus fresh nonce-bound dashboard schedule proof | Validate the current rollback baseline after configuring the two preview AI secrets | Pass: exact health and active-version attribution, exact encrypted-secret binding names/types, preview separation, exactly two permanent schedules, no one-minute route, tracked LF evidence, and unchanged backup key version 1; no candidate deployment occurred |
| 2026-08-03 | Candidate `c1911f8` not deployed | Existing Cloudflare AI Gateway dashboard | Reconcile exact Gateway identity and inspect the approved spend rule without mutation | Pass by direct owner inspection: the existing exact-name Gateway opened and exactly one enabled, global, fixed 30-day $9.50 rule was present; the guarded AI workflow must still repeat its automated same-run verification before dispatch |
| 2026-07-27 | `50569e6` | Local clean-room verification | Frozen install, TypeScript, unit/integration/security, contract, Worker, browser, docs, build, and release scan | Pass: 627 unit/integration/security tests with one intentional skip; integration-only subset 243 with one skip; 179 contract; 75 Worker; 29 browser; documentation, production build, security scan, and diff checks passed |
| 2026-07-27 | Current live preview | Authenticated private desk | Reload session, status rail, synchronized-event list, queue retry count, AI allowance, and event-write control inspection | Pass: private desk loaded after a fresh page open; state was `Healthy`, last synchronization was within 15 minutes, queue retries were zero, the synchronized-event count was zero, AI showed $0.00 of $9.50, and no event create/edit/move/cancel/delete control was present |
| 2026-07-27 | `a2bbc80` | Guarded preview workflow | Capture one privacy-safe scheduled outcome without deployment or configuration work | Diagnostic only: workflow passed and every mutation job was skipped, but the classifier accepts only recovery crons and returned `no_scheduled_event`; this does not prove the 15-minute calendar-maintenance path |
| 2026-07-28 | Task 1 candidate | Local | Permanent calendar-maintenance evidence, strict safe-tail classification, and immutable-ref observer policy | Pass: 755 unit/integration tests with one intentional skip, 179 contract tests, 75 Worker tests, TypeScript, documentation, build, and security scan |
| 2026-07-29 | Task 6 candidate | Local | Generated candidate isolation, exact operator selection, same-run AI attestation, separate rollback, security scans, and permanent cleanup contract | Pass: typecheck; 1,017 unit/integration/security tests with two intentional skips; 179 contract; 94 Worker; documentation, build, normal preview artifact validation, release security scan, zero migration diff, and zero secret-inventory diff. Fresh live exercises remain pending |
| 2026-07-29 | `d4de4de` | Local Task 7 freeze | Full focused and aggregate gates, generated normal/foundation/AI/six-fault candidate matrix, safe-tail observer shapes, workflow/client/secret checks, and pre-cleanup residue contract | Pass with a documented plan-wording concern: 1,040 unit/integration/security tests with one intentional skip; 179 contract; 94 Worker; 35 browser; TypeScript, documentation, build, release security scan, normal preview validation, eight generated candidates, nine exact printer shapes, zero migration diff, and zero acceptance-range production delete-call additions. Strict future cleanup mode remains intentionally RED for exactly 48 dedicated and 34 shared temporary paths. No live acceptance or provider mutation was performed |
| 2026-07-29 | Pending post-push identifier | Local final-fix wave 2 | Parser-backed workflow reachability, post-restore closure, exact AI pricing policy, the then-tested candidate-window recovery exclusion, expanded Task 8 inventory, explicit preview/production artifact validation, and nondeploy dry-runs | Pass: 1,170 unit/integration/security tests with one intentional skip; 179 contract; 94 Worker; 35 browser; TypeScript, documentation, build, release security scan, real YAML parsing, 40 immutable action references, preview and production build-validation-attestation-dry-run chains, eight generated candidates, 62 safe-tail assertions, zero migration paths, zero added Google event writes, zero added source delete calls, and exit-zero diff check. The wave-2 build, validation, attestation, and nondeploy dry-run evidence remains valid; its full-lifetime recovery-exclusion claim was incomplete for the 06:05 route and is superseded by wave 3. Strict cleanup remains intentionally RED while exactly 56 dedicated and 35 shared paths remain. No live acceptance, provider mutation, push, or deployment was performed |
| 2026-07-29 | Pending post-push identifier | Local final-fix wave 3 | Candidate lifetime and AI-attestation admission once at the scheduled entry point before every cron-specific route | Pass: 1,180 unit/integration/security tests with one intentional skip; 179 contract; 94 Worker; 40 scheduled-handler tests; and 35 browser E2E tests. The requested wave-3 preview and production Wrangler dry-runs were safety-denied before process start and were not executed; the wave-2 dry-run result above remains historical. No live acceptance, provider mutation, push, or deployment was performed |
| 2026-08-01 | Gate 0 candidate pending exact-tip review and safe push | Local clean-room freeze gate | Exact focused Tasks 1-6 replay; TypeScript; unit/integration/security, contract, Worker, browser, documentation, release scan, aggregate check, explicit preview and production builds, deployment-configuration validation, strict pre-cleanup residue, and static privacy/scope checks | Pass: 101 unit files and 1,693 tests passed with one intentional skipped file/test; 14 contract files and 179 tests passed; 7 Worker files and 110 tests passed; 36 browser tests passed; both builds and both deployment validators exited zero; strict pre-cleanup mode matched the frozen Task 9 residue with exactly three expected strict assertions failing and 12 assertions passing; migration changes, new secret names, credential-assignment records, Google event-write violations, protected-value violations, and frozen plan/spec differences were zero; preview and production each contained exactly two normal schedules and backup key version 1; the structural R2 contract found one shared adapter and exactly two approved permanent callers. No live acceptance, provider mutation, deployment, cleanup, or completion claim was performed |
| 2026-08-01 | Repaired Gate 0 candidate pending fresh exact-tip review and safe push | Local Task 7 review-fix wave | Bind the permanent safe-push adapter to the canonical reviewed commit object and exact expected-parent lease; remove seven historical trailing blank lines; rerun affected and complete candidate gates | Pass: the regression was the sole intentional RED while 1,692 other unit tests passed; focused GREEN passed 14 adapter tests; TypeScript, documentation coverage, release security, full aggregate check, 36 browser tests, explicit preview and production builds, both deployment validators, current diff check, and complete authoring-base range diff check exited zero. The first exact-tip review was invalidated and no push, deployment, live acceptance, provider mutation, cleanup, key change, or completion claim was performed |
| 2026-08-06 | Current classifier-enabled candidate launcher repair | Local provider-free verification | Replace the Windows-incompatible launcher path, verify exact-root/descendant containment, malformed active-state rejection, bounded child capture, and rerun classifier/cleanup/native safety gates | Pass: parser, direct launcher, classifier behavior, Wrangler failure classifier, cleanup deadline, and native suite all exited zero with allowlisted markers. No live controller, deployment, rollback, schedule, binding, secret, key, or provider action ran; the previous live approval is consumed and a fresh approval is required before retry |
| 2026-08-06 | Documentation-contract repair and full local gate rerun | Local provider-free verification | Restore the required privacy-safe cost-review anchors and rerun the complete `pnpm check` through bounded native capture | Pass: focused cleanup contract and full typecheck, unit, contract, Worker, documentation, build, and security stages exited zero. No provider, deployment, rollback, schedule, binding, secret, key, or live action ran |
| 2026-08-06 | Current progress documentation alignment and final local replay | Local provider-free verification | Align the plain-language and technical progress records with the current gate map, then replay the complete local check | Pass: `pnpm docs:check` and the complete bounded `pnpm check` exited zero; direct launcher/classifier contracts remain green. Live acceptance, provider cleanup, and Phase C handoff remain pending fresh evidence |
| 2026-08-06 | Current provider-free replay after execution-boundary rejection | Local provider-free verification | Reconcile the release wording, record the safe preflight rejection, and rerun the complete `pnpm check` | Pass: the complete bounded `pnpm check` exited zero; the execution-boundary rejection occurred before controller process start; no provider, deployment, rollback, schedule, binding, secret, key, or live action ran. A fresh exact approval remains required before the single live attempt |
| 2026-08-07 | Authorized classifier-enabled live attempt | Preview controller, baseline schedule checkpoint | Validate the fresh baseline challenge, collect visible Cron Trigger confirmation, and proceed only within the bounded evidence wait | Stopped safely before candidate dispatch: challenge/evidence schema, nonce, active-version hash, time ordering, and two-cron shape were valid, but the evidence arrived after the controller wait and the safe category was `live_schedule_evidence_timeout`; no deployment or rollback occurred |
| 2026-08-07 | Authorized classifier-enabled live attempt after wait-window repair | Preview controller, baseline schedule checkpoint | Validate fresh baseline evidence, attempt one monitored candidate deployment, and verify automatic rollback or a safe failure | Failed closed after valid baseline evidence: `candidate_deploy_resource_missing` and `rollback_outcome_uncertain` with `rollback_verified: false`; read-only deployment/version reconciliation found no candidate or rollback marker and preview health remained exact. No retry or manual mutation was performed; the live deployment/rollback gate remains pending |
| 2026-08-07 | Second authorized classifier-enabled live attempt after owner access confirmation | Preview controller, baseline schedule checkpoint | Re-run one monitored candidate deployment and verify automatic rollback or a safe failure | Failed closed again after valid baseline evidence: `candidate_deploy_resource_missing` and `rollback_outcome_uncertain` with `rollback_verified: false`; read-only deployment/version reconciliation again found no candidate or rollback marker, the bounded Wrangler identity probe decoded with Worker/edit and Queue metadata but no R2 text, and preview health remained exact. No further mutation is allowed until the provider-side deploy-resource cause is reconciled and a fresh exact approval is supplied |
| 2026-08-07 | Candidate artifact compile-only reconciliation | Local candidate artifact, Wrangler dry-run | Verify the candidate's generated configuration and bundle without provider mutation | Pass: Wrangler dry-run exited zero with bounded output, no stderr, and a temporary output directory; safe failure category `none`. This validates local bundling/configuration but is not deployment acceptance |
| 2026-08-07 | Read-only binding reconciliation | Preview Worker dashboard, Settings → Bindings | Compare the deployed Worker binding shape with the reviewed candidate shape without editing provider state | Clarified evidence: both the preview R2 bucket and Queue exist; the earlier generic missing-binding report did not establish a mismatch. No binding repair or deployment retry is authorized |
| 2026-08-07 | Read-only deployment activity reconciliation | Preview Worker dashboard, Deployments/Activity | Determine whether the latest provider rejection created a version/deployment record | Evidence: owner reports no failed deployment entry. The rejection is therefore treated as pre-version; the account/context and version-capability gate remains pending |
| 2026-08-07 | Bounded Wrangler permission metadata probe | Saved Wrangler OAuth session | Determine whether `whoami --json` exposes the version-upload capability without printing identity data | Pass: command exited zero and decoded; permission names were not exposed, so Worker Scripts Write remains inconclusive and requires owner-scoped dashboard inspection |
| 2026-08-07 | Artifact-local Wrangler reconciliation | Candidate artifact, local compile-only dry-run | Confirm the controller's artifact-local Wrangler and exact deploy arguments are locally valid without provider mutation | Pass: root/candidate/rollback Wrangler versions matched; candidate-local exact dry-run exited zero with no stderr and created temporary output. Live upload remains the only failing boundary |
| 2026-08-07 | Current deployed-version shape reconciliation | Existing preview Worker version, read-only Wrangler list/view | Compare safe structural presence of metadata/resources and expected R2/Queue bindings without retaining identifiers or payloads | Pass: list and detail decoded successfully; the existing version contains metadata/resources and both expected binding names. The pre-version live upload rejection remains unresolved |
| 2026-08-07 | Wrangler OAuth/account-context checkpoint | Saved Wrangler OAuth session, owner privilege confirmation | Refresh the saved OAuth grant for the intended account/scopes without deployment, then repeat read-only identity/version checks | Pass: owner reauthenticated Wrangler; refreshed `whoami` and version list/detail checks exited successfully and decoded. No deployment occurred; a fresh monitored mutation still requires exact approval |
| 2026-08-07 | Post-reauthentication read-only verification | Saved Wrangler OAuth session, existing preview Worker version | Verify refreshed identity and current version paths before any new mutation | Pass: `whoami` and version list/detail exited successfully and decoded; both expected R2/Queue references remained present. A fresh monitored candidate attempt still requires exact approval |
| 2026-08-07 | Third authorized classifier-enabled live attempt after reauthentication | Preview controller, baseline schedule checkpoint | Test whether refreshed Wrangler OAuth changes the live upload path and verify rollback or safe failure | Failed closed again: `candidate_deploy_resource_missing`, `rollback_outcome_uncertain`, `rollback_failure_category: resource_missing`, `rolled_back: false`, `rollback_verified: false`; final read-only deployment/version lists had ten rows each with no candidate/rollback markers and preview health remained exact. Further retries are blocked pending Cloudflare-side diagnosis |
| 2026-08-07 | Baseline evidence wait-window repair | Local provider-free verification | Align the controller wait with its existing 600-second evidence freshness contract and replay the native safety matrix | Pass: the test-first wait contract was RED at 180 seconds and GREEN at 600 seconds; all 13 local controller/launcher/classifier/cleanup/native contracts exited zero. No provider, deployment, rollback, schedule, binding, secret, key, or configuration action ran |
| 2026-08-10 | Fresh approved classifier-enabled retry after R2 incident resolution | Preview controller, baseline schedule checkpoint | Re-run one monitored candidate deployment and verify automatic rollback or a safe failure | Stopped safely before candidate dispatch: fresh baseline challenge was issued, but no owner schedule confirmation arrived within the 600-second bound; safe category `live_schedule_evidence_timeout`; no candidate or rollback challenge, deployment, binding, schedule, secret, key, or database mutation occurred |
| 2026-08-10 | Fresh approved classifier-enabled retry after owner schedule confirmation | Preview controller, baseline schedule checkpoint, live upload boundary | Verify the post-resolution candidate upload and automatic rollback | Failed closed after valid nonce-bound baseline evidence: `candidate_deploy_resource_missing` with `not_found`/`temporary_log`, followed by `rollback_outcome_uncertain` and rollback `resource_missing`; `rolled_back: false`, `rollback_verified: false`; no candidate or rollback challenge or version marker appeared and no manual retry was performed |
| 2026-08-10 | Final approved retry after external GitHub-auth boundary repair | Preview controller, observer resolution | Test the currently reviewed `foundation_probe` path once with normal external GitHub authentication | Failed closed before candidate dispatch: observer workflow selection succeeded, but GitHub Actions startup exceeded the controller's fixed 120-second observer-resolution window; one observer listener remained active, all candidate and rollback jobs were skipped, and no Cloudflare deployment, rollback, schedule, binding, secret, key, database, or calendar mutation occurred |
| 2026-08-10 | Owner-reported Claude Code direct preview deploy | Read-only Wrangler deployment list and public preview health | Verify whether the separately initiated deploy reached the live Worker | Pass for live state only: deployment list decoded with ten entries and a newest API/CLI deployment within 30 minutes; one version was present and public health returned HTTP 200 with the safe `ok` contract. The reviewed remote Phase B branch and active worktree remain unchanged, so source attribution and reproducible release evidence are still pending |
| 2026-08-10 | Pushed-commit verification after Claude report | Remote `codex/phase-b-foundation` diff inspection | Determine whether the pushed commit contains the deployed implementation change | Pass for repository state only: the new remote commit is present, but its diff changes one documentation file and zero `src`, `scripts`, workflow, or Wrangler configuration files. The deployed implementation source remains unattributed |
| 2026-08-10 | Corrected version-upload/deployment reconciliation | Candidate worktree `c1911f8`, Wrangler version-upload records, owner traffic audit | Separate successful version creation from the untested deploy/traffic boundary | Pass for artifact and history only: three `wrangler versions upload` calls succeeded for the artifact pinned to `c1911f8`; no `wrangler deploy` call occurred in this session. A later 100% promotion at 20:37:36Z was external to the session and is not deployment acceptance. |
| 2026-08-11 | Observer metadata transient-read repair | Resolver adapter, safe GitHub workflow metadata, local acceptance controller | Reconcile the newest failed observer attempt and prevent one transient provider-process read from aborting the bounded observer window | Safe identity/topology/artifact/quota checks passed and the same metadata replayed locally; the live failure was classified as a transient bounded metadata-read/timing race. The resolver now retries one early settled provider-process failure within its unchanged deadline while preserving fail-closed timeout, cancellation, and malformed-response contracts. Local unit, type, contract, Worker, docs, build, deploy-check, and security gates pass; monitored candidate deployment remains pending. |
| 2026-08-11 | Corrected direct monitored candidate controller | Reviewed candidate artifact at `d786424`, preview Worker | Verify candidate deployment, live preconditions, and automatic rollback guard | Pass for the direct controller boundary: candidate deploy exited zero, live preconditions passed, a new active version was observed, rollback was not required, backup key version remained unchanged, exactly two permanent schedules remained, the exact health contract passed, and no one-minute route was present. This is not the GitHub workflow closure or the full Phase B live matrix. |
| 2026-08-11 | Fresh normal maintenance run after owner Google sign-in | Read-only Wrangler tail, preview Worker and Queue | Determine whether stale synchronization state can recover without another OAuth mutation | Pass for maintenance/renewal: safe `vision.calendar-maintenance/v2` evidence reported `outcome: succeeded`, `category: none`, `repairOutcome: reserved`, and `renewalOutcome: completed`; the Google webhook returned OK and the Queue accepted the repair messages. Authenticated sync completion and a fresh page status remain required. |
| 2026-08-11 | Owner-approved disposable Vision-calendar event | Google Calendar, preview webhook/Queue, authenticated Vision desk | Verify provider-to-Vision near-real-time delivery and deletion without retaining event content | Pass: the temporary event notification returned webhook OK, one Queue message was accepted, and the user confirmed the event appeared in Vision. After deletion, a second webhook returned OK, one Queue message was accepted, and final authenticated status/events reads returned HTTP 200 with the event gone. |

The live preview schema is current through migration 0009. The normal daily
schedule remains deployed while a fresh encrypted backup and disposable
restore drill proceed.

## Live-acceptance instrumentation gaps

The four acceptance areas now have closed local instrumentation and generated
preview-only candidate routing, but each still needs its fresh live
observation:

- The 15-minute scheduler now emits one exact
  `vision.calendar-maintenance/v1` record after cleanup, repair, and renewal.
  The safe-tail observer checks out the workflow dispatch commit, proves the
  checkout equals `github.sha` before receiving provider credentials, retains
  its separate non-mutating concurrency group and bounded timeout, and accepts
  only that closed record on the exact normal cron. Candidate deployment
  repeats the exact workflow identity, commit, active status, and evidence
  family proof as the penultimate control, followed by an actual generated
  candidate lifetime check immediately adjacent to deploy. A fresh guarded
  preview capture is still required as live evidence.
- The dedicated foundation candidate emits only fixed booleans and aggregate
  counts through read-only, owner-scoped database/R2 boundaries. It needs a
  fresh guarded observer/candidate/rollback exercise.
- Diagnostics now measure database and R2 usage independently, and the
  dedicated AI candidate emits fixed-shape aggregate provider usage only after
  a same-run read-only Gateway-limit verification. All five pricing and
  reservation bindings must also exactly match the source-controlled policy in
  source configuration, generated artifacts, runtime parsing, and provider
  state. It needs one harmless live category request plus a fresh guarded
  capture and rollback.
- The six-value preview fault harness can exercise delayed Queue work, failed
  synchronization, channel expiry, database outage, R2 upload failure, and the
  AI budget stop. Each candidate is isolated behind one generated selector,
  one temporary schedule, an active observer proof, and a separate rollback;
  the live failure matrix remains pending.

The normal artifact contains only the two permanent schedules and no acceptance
binding. Each temporary candidate carries a canonical bounded deadline; its
complete maximum lifetime must avoid the protected recovery interval. The
scheduled entry point parses any deployed candidate, rechecks lifetime and
overlap against wall-clock execution time, and validates any required AI
attestation before any cron dispatch, including both permanent routes, so
delayed delivery cannot extend the lifetime. Normal non-candidate dispatch,
purge, permanent recovery, and cleanup behavior remain unchanged. After the
acceptance matrix, source cleanup must be reviewed, deployed, and verified
before any provider cleanup. The
permanent cleanup contract names the exact 98 dedicated deletion paths plus 51
shared active-residue paths spanning runtime bindings, observer modes, routes,
selectors, scheduler branches, references, and tests. Its Task 9 changed-path
manifest contains exactly 149 paths, and the classifier covers exactly 184
total paths. The dedicated inventory
now includes the observer validator and test, acceptance-window script and
test, rollback-lifecycle validator and test, and both simple/technical
references for every validator. The shared inventory separately maps the active
cleanup instructions in `cost-review.md`, `environments.md`,
`incident-runbook.md`, and `secrets.md` by their exact content markers. It
explicitly retains normal health warnings, their tests, and the OAuth
`database_unavailable` category. It also retains recovery/import tooling,
`backups/v1/`, key version 1, permanent security scans, maintenance evidence,
measured usage warnings, and bounded observer behavior. Operations history and
evidence, including `restore-drill.md`, credential history, release evidence,
and the setback tree, is classified separately and remains permanent.
Operator-only offline restore variables in `backup-and-restore.md` likewise
remain documented after their temporary Worker inventory is removed.

Before every candidate, the guarded workflow requires live preview health,
exactly the two normal schedules, and an explicit provider binding array with
no temporary binding. Missing, null, malformed, or failed provider responses
fail closed. Rollback uses the same provider-state validator after deploying
the normal artifact, but restored normal state alone does not close the
lifecycle. A separate closure run must bind the normal commit, both provider
checks, and fresh signed-in diagnostics/calendar reads to the newest candidate.
Later candidates and cleanup remain blocked until that exact closure passes.

## Release decision

**Not complete yet.** The live database is current. The backup/restore,
synchronization timing and repair, live failure states,
wrong-account/revocation privacy checks, and OpenAI cost-path acceptance still
need fresh evidence.

## Closure-policy status

The permanent four-disposition Task 1-8 inventory and Task 9 changed-path
manifest are locally enforced. This is implementation evidence only, not a
claim that Task 9 cleanup, provider cleanup, or live acceptance has run.
Backup key version 1 remains unchanged.

Gate 0 local verification and immutable-candidate publication are complete for
the current checked-out tip. The final whole-branch exact-tip review reported
zero Critical, Important, and Minor findings; the reviewed tip was published
through the permanent privacy-safe Git adapter; and local/remote equality was
confirmed with a closed Boolean-only result. Task 8 live acceptance remains
blocked until its provider-facing exercises and cleanup evidence succeed.

The first frozen tip failed review because its permanent adapter pushed
symbolic `HEAD` instead of the canonical reviewed commit object. That historical
issue was repaired: the final review package used the canonical object under an
exact expected-parent lease, and the privacy-safe publication/equality checks
then passed. The historical invalid attempts remain in the ledger for audit
context and are not current release blockers.

The final whole-range review package is an ignored local artifact containing
the exact commit list, stat, and full-context diff. A Windows-only Bash-helper
incompatibility was logged and resolved with the documented native fallback;
it changed no implementation, live, provider, deployment, credential, or key
state. Final package generation resolved the full candidate object directly
from Git in the same command; no abbreviated identifier was expanded by
assumption.

After the ledger-recorded exact-tip report reconciliation, this evidence is
refrozen for the current local candidate. This records documentation alignment
only; no live action, provider action, deployment, push, or completion claim
occurred.

After the separately logged report-refresh context recurrence, the complete
bounded Gate 0 command set was rerun successfully and this evidence is refrozen
again. The result remains local implementation evidence only: no live action,
provider action, deployment, push, cleanup, credential-value read, key change,
or Phase B completion occurred.

### Historical invalid review attempts (superseded by final publication)

The following entries explain why earlier review attempts cannot be used as
current release blockers. The final exact-tip review, privacy-safe publication,
and local/remote equality result above are the authoritative Gate 0 evidence.

One exact-tip review attempt was invalidated before verdict because a combined
read exceeded its review boundary. The recurrence is logged, this evidence is
refrozen, and a fresh bounded-file review remains required before any push or
live action. The invalid review proves no acceptance result.

A replacement exact-tip review was also invalidated before package inspection
when its read-only Git probe used an unsupported Windows excludes override. The
recurrence is logged, no state changed during that review, and this evidence is
refrozen for another fresh review using only the proven Git read arguments.

The next review also stopped without verdict before package inspection because
an intentionally ignored local SDD constraint file was queried through the
commit instead of read from the worktree. That access-method recurrence is
logged; this evidence is refrozen again and proves no review or live result.
