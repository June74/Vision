# Phase B preview fault and cleanup plan map

> Planning artifact only. No tracked source, test, workflow, configuration, documentation, provider, secret, schedule, or deployment state was changed while producing this report.

## Goal and scope

Implement the approved preview-only, authenticated fault harness for exactly six non-secret scenarios, gather one closed terminal record per deployment, restore the immutable normal Worker after every terminal result, and later remove all temporary reachability without reverting permanent hardening.

This map covers:

- the five authenticated diagnostic overlays;
- the one scheduled R2 object-write failure boundary;
- strict scenario admission and exact evidence classification;
- browser, Worker, integration, policy, security, rollback, and cleanup coverage;
- current role-probe and fenced-restore residue that the final cleanup must remove;
- permanent behavior that the cleanup must retain.

This map does not cover the foundation aggregate probe, measured usage implementation, normal maintenance evidence implementation, live provider mutation, Google revocation simulation, or any Phase C event-write surface.

The approved source of truth is `docs/superpowers/specs/2026-07-28-phase-b-acceptance-instrumentation-design.md`, especially lines 330-438, 440-490, and 496-577.

## Scope gate

This is a full feature and later cleanup, not a one-file change. The fault phase plausibly touches domain policy, authenticated route assembly, scheduler assembly, environment parsing, a temporary job, safe-tail tooling, preview configuration/workflow, browser/Worker/integration/policy/security tests, operations documents, and mirrored references. Implementation must remain in the existing isolated worktree and use test-driven development.

No schema migration, provider credential, new secret, public operator route, browser activation mechanism, database write, Queue send, Google event write, R2 mutation, backup-key change, or provider-limit increase is part of this work.

## Confirmed live paths

Authenticated diagnostic path:

```text
App.loadApp()
  -> readSession()
  -> readCalendarSetup()
  -> readFoundationSnapshot()
  -> GET /api/diagnostics/status
  -> resolveRouteDependencies()
  -> authenticateDiagnosticRequest()
  -> sessions.findSession()
  -> requireSession()
  -> repositoryForOwner(session.ownerId)
  -> DiagnosticRepository.readFoundationFacts(observedAt)
  -> apply optional preview overlay
  -> calculateFoundationHealth(facts, observedAt)
  -> existing { status: ... } response
  -> parseStatus()
  -> FoundationStatus + CostStatus
```

Current exact files:

- `src/client/App.tsx:25-59,67-89,152-193`
- `src/client/status/api.ts:52-74,98-123`
- `src/server/api/diagnostic-routes.ts:61-95,179-212,214-234`
- `src/data/repositories/diagnostic-repository.ts:52-67,158-290`
- `src/domain/operations/health.ts:39-44,57-87,89-214`
- `src/client/status/FoundationStatus.tsx:5-98`
- `src/client/status/CostStatus.tsx:5-56`
- `src/worker.ts:67-106,120-129`

Scheduled R2 write path:

```text
Cloudflare scheduled event
  -> worker.scheduled
  -> scheduled()
  -> runScheduledJob(controller.cron, ...)
  -> recovery()
  -> createProductionScheduledRecoveryDependencies()
  -> runScheduledRecovery()
  -> createDailyBackup()
  -> BackupObjectStore.putIfAbsent()
  -> R2Bucket.put()
```

Current exact files:

- `src/worker.ts:122-129`
- `src/jobs/scheduled.ts:43-89,175-249`
- `src/jobs/create-daily-backup.ts:55-83,109-190`
- `src/data/backup/r2-object-store.ts:8-55`
- `tests/integration/jobs/daily-backup.test.ts:82-163,233-307,309-387`

The current one-minute preview cron routes to the temporary role probe, not to a fault harness:

- `wrangler.jsonc:35-69`
- `src/jobs/scheduled.ts:61-80,175-212`
- `scripts/validate-preview-deploy-config.ts:37-83`
- `tests/unit/server/wrangler-routing.test.ts:65-77,132-260`

## Strict scenario contract

Create one shared tuple and derive the TypeScript type from it. Do not duplicate string unions in the route, scheduler, workflow script, or classifier.

```ts
export const PREVIEW_FAULT_SCENARIOS = Object.freeze([
  "queue_delayed",
  "job_failed",
  "channel_expired",
  "database_unavailable",
  "r2_upload_failed",
  "ai_stopped",
] as const);

export type PreviewFaultScenario =
  (typeof PREVIEW_FAULT_SCENARIOS)[number];
```

Recommended temporary home:

- Create `src/domain/operations/temporary-preview-fault.ts`.
- Create both mirrored references:
  - `docs/reference/simple/src/domain/operations/temporary-preview-fault.md`
  - `docs/reference/technical/src/domain/operations/temporary-preview-fault.md`

The environment binding is `PREVIEW_ACCEPTANCE_FAULT_SCENARIO`. It is a non-secret server-only binding and must:

- be absent in normal local, preview, and production artifacts;
- accept only one scalar value from the six-value tuple;
- be admitted only when `VISION_ENV === "preview"`;
- fail with a constant error before scenario-specific dependency construction;
- never be read from a request, query, cookie, header, database row, Queue message, model output, or client bundle;
- never be accepted in production, even if the value is otherwise valid.

Production rejects every acceptance scenario.

Add a dedicated parser in `src/server/env.ts`; do not make request handlers inspect raw environment strings.

```ts
export function parseTemporaryPreviewFaultScenario(
  environment: Readonly<{
    VISION_ENV: unknown;
    PREVIEW_ACCEPTANCE_FAULT_SCENARIO?: unknown;
  }>,
): PreviewFaultScenario | null;
```

`null` is permitted only when the binding is absent. Any present value outside preview, any unknown value, array, object, empty string, comma-separated pair, whitespace variant, or case variant throws `Temporary preview fault configuration is invalid.` without reflecting the supplied value.

Add `PREVIEW_ACCEPTANCE_FAULT_SCENARIO` to `RuntimeEnvSchema` only for the temporary phase and classify it in `src/server/client-binding-boundary.ts` as runtime-client-forbidden. The final cleanup removes both entries.

## Scenario-to-fact map

The normal baseline must be authenticated, owner-correct, and `Healthy` immediately before each candidate. The overlay changes only the listed content-free facts. It never normalizes unrelated unhealthy facts; unexpected precedence causes acceptance to stop.

| Scenario | Temporary injection | Expected health/API facts | Expected UI | Retention after cleanup |
|---|---|---|---|---|
| `queue_delayed` | Set `oldestQueuedJobAt` to `observedAt - FOUNDATION_HEALTH_THRESHOLDS.queueFreshnessMs`; leave retry count and every other fact unchanged | `state="Delayed"`, `oldestJobDelayMs=900000`, `warningCodes` contains `QUEUE_DELAYED` | `Delayed`; catching-up summary and refresh action; never `Healthy` | Delete overlay and reachability test |
| `job_failed` | Set `failedJobCount=1` | `state="Action required"`, `warningCodes` contains `FAILED_JOBS` | repair-run action; never `Healthy` | Delete overlay and reachability test |
| `channel_expired` | Set `channelExpiresAt` to an exact copy of `observedAt` | `state="Action required"`, `warningCodes` contains `CHANNEL_EXPIRED` | safe generic recovery action; never `Healthy` | Delete overlay and reachability test |
| `database_unavailable` | Set `databaseAvailable=false` and `safeErrorCode="database"` after successful session/owner admission | `state="Action required"`, warnings contain `DATABASE_UNAVAILABLE` and `SYNC_ACTION_REQUIRED` | database-service action; never `Healthy`; public response remains 200 with the existing status schema | Delete overlay and reachability test |
| `r2_upload_failed` | Replace only the object-write port with a constant failing writer before it calls R2 | Scheduled result throws the existing constant `Backup storage write failed.` after one closed fault record; no diagnostic overlay | Authenticated calendar remains readable; no backup-success claim is accepted | Delete temporary writer/job/reachability tests; retain normal R2 adapter and backup failure classification |
| `ai_stopped` | Set only `aiMonthlyCents=950` | `aiSpendTier="stopped"`, warning contains `AI_BUDGET_STOPPED`, and state must be non-Healthy | `Action required`, `AI paused`, `$9.50 of $9.50`, and calendar events remain visible | Delete overlay; retain the real 950-cent policy, non-AI survival, and safe hard-stop presentation |

### AI hard-stop resolution

Current source returns `state="Healthy"` at 950 cents (`src/domain/operations/health.ts:194-213`; current test at `tests/unit/domain/health.test.ts:151-167`). That conflicts with the approved rule that an injected failure must never render `Healthy`.

The narrow resolution is permanent policy, not scenario awareness:

- classify only `aiSpendTier === "stopped"` as `Action required`;
- leave 800-cent warning and 900-cent optional stop independent of deterministic foundation health;
- keep `AI_BUDGET_STOPPED` as the allowlisted warning;
- add an AI-stopped branch in `FoundationStatus` before the generic failed-job fallback;
- retain `CostStatus` and the existing deterministic-route survival contract.

The permanent UI action should state that AI requests remain paused at the approved monthly limit while calendar viewing and synchronization remain available. It must not suggest raising the limit or calling a provider.

This makes the `ai_stopped` overlay minimal (`aiMonthlyCents` only), uses the real 950-cent policy, and leaves no scenario-specific UI code after cleanup.

## Overlay injection boundary

Modify `DiagnosticRouteDependencies` in `src/server/api/diagnostic-routes.ts` with a temporary, pure optional transform:

```ts
readonly overlayFoundationFacts?: (
  facts: FoundationHealthFacts,
  observedAt: Date,
) => FoundationHealthFacts;
```

Apply it only here:

```text
authenticateDiagnosticRequest succeeds
  -> repositoryForOwner succeeds
  -> readFoundationFacts succeeds
  -> overlayFoundationFacts, if present
  -> calculateFoundationHealth
```

Invariant: the existing session and owner authorization must succeed before
the overlay can be accessed.

Do not apply it:

- during `resolveRouteDependencies`;
- before `sessions.findSession`;
- to `/api/calendar/events`;
- to category correction;
- to templates;
- to a public operator endpoint;
- to repository SQL;
- to Queue, Google, OpenAI transport, R2, or logger dependencies.

`createProductionDiagnosticDependencies()` must parse the scenario before constructing scenario-specific functions. It may still construct the normal session/database repository required for authenticated status. For `r2_upload_failed`, the diagnostic resolver supplies no overlay.

The pure overlay returns a new frozen object and does not mutate repository-owned facts. It validates `observedAt`, uses existing thresholds/constants, and has no imports from database, integrations, jobs, Worker bindings, or logging.

## Scheduled R2 failure boundary

The existing `createDailyBackup()` catches `store.putIfAbsent()` failures and converts them to `Backup storage write failed.` at `src/jobs/create-daily-backup.ts:161-171`. Preserve that permanent classification.

Extract the object-write call into a narrow helper used by both the normal backup job and the temporary scheduled exercise:

```ts
export interface BackupObjectWriter {
  putIfAbsent(
    key: string,
    body: Uint8Array,
    metadata: BackupObjectMetadata,
    bodySha256: string,
  ): Promise<boolean>;
}

export async function putBackupObjectIfAbsent(
  writer: BackupObjectWriter,
  input: Readonly<{
    key: string;
    body: Uint8Array;
    metadata: BackupObjectMetadata;
    bodySha256: string;
  }>,
): Promise<boolean>;
```

The helper owns the existing constant failure conversion. `createDailyBackup()` continues to call it with the real store and unchanged values.

Create `src/jobs/temporary-preview-fault.ts` with:

- the one-minute cron constant;
- the exact evidence type;
- a dependency that supplies only a constant failing `BackupObjectWriter`;
- the six-scenario scheduled dispatcher;
- one closed evidence emitter;
- an `r2_upload_failed` branch that calls the shared write helper with content-free in-memory values and expects the constant failure;
- no `R2Bucket.put`, database, backup-key, Google, Queue, restore, or event capability.

The constant failing writer throws before inspecting its arguments and before calling any provider. The runner emits the safe failure record and then rethrows a constant scheduled failure so Cloudflare cannot classify the exercise as successful. A prior valid backup is neither read, overwritten, verified, nor deleted.

This directly tests the same write/classification helper as the normal job without depending on whether the current UTC daily object already exists.

## Exact terminal evidence

Use one four-key record:

```ts
export interface TemporaryPreviewFaultEvidence {
  readonly evidenceType: "vision.preview-fault/v1";
  readonly scenario: PreviewFaultScenario;
  readonly outcome: "succeeded" | "failed";
  readonly category: "none" | "backup_storage_write_failed";
}
```

Only these combinations are valid:

- the five diagnostic overlays: `outcome="succeeded"` and `category="none"`;
- `r2_upload_failed`: `outcome="failed"` and `category="backup_storage_write_failed"`.

The action envelope is exactly:

```ts
{
  action: "acceptance.preview-fault",
  evidence
}
```

Invalid configuration emits no attributed evidence and throws a constant error. Missing evidence therefore fails acceptance. Do not invent an extra runnable scenario such as `unknown`, `none`, or `unattributable`.

The safe-tail classifier must:

- accept the record only on the one-minute cron;
- require the exact action and exact four-key evidence shape;
- require a plain object with `Object.prototype` or `null` prototype;
- reject accessors without invoking them;
- reject symbols, hidden own keys, extra keys, inherited keys, prototypes, wrong types, unknown scenarios, inconsistent outcome/category pairs, mixed evidence types, wrong cron, and raw provider text;
- reconstruct a new frozen allowlisted record;
- accept exactly one terminal record and fail closed on a duplicate, rather than exiting successfully on the first and ignoring the second;
- clear bounded framing state after each complete event and never persist a raw line.

Modify:

- `scripts/safe-tail-classifier.ts`
- `scripts/print-safe-tail.ts`
- `tests/unit/scripts/safe-tail-classifier.test.ts`
- `tests/unit/scripts/print-safe-tail.test.ts`

Add `--fault-only <exact-scenario>` to `print-safe-tail.ts`. It must reject missing, extra, combined, comma-separated, or unknown arguments and emit the existing closed `no_scheduled_event` fallback when no exact record arrives. The final cleanup removes `--fault-only` and fault classification while retaining bounded framing and permanent normal recovery/maintenance classification.

## Preview configuration and workflow boundary

Normal preview configuration must return to exactly two schedules:

```text
*/15 * * * *
5 6 * * *
```

Change `wrangler.jsonc` so the committed normal preview environment has no one-minute cron and no fault binding. Change `scripts/validate-preview-deploy-config.ts` so a normal generated artifact rejects both.

Create a temporary builder:

- `scripts/prepare-preview-fault-deploy-config.ts`
- mirrored simple and technical references;
- focused tests in `tests/unit/server/wrangler-routing.test.ts`.

The builder:

1. reads the already generated normal `dist/vision/wrangler.json`;
2. validates it with `validatePreviewDeployConfig`;
3. validates one exact scenario;
4. requires `targetEnvironment="preview"` and `vars.VISION_ENV="preview"`;
5. rejects any pre-existing one-minute trigger or fault binding;
6. adds exactly one one-minute trigger and exactly one scenario binding;
7. preserves the two normal triggers, queue, bucket, safe variables, and all unrelated generated fields;
8. validates the transformed artifact;
9. writes no configuration content or input value to stdout/stderr;
10. fails with one constant message.

Do not use `wrangler --var`; current policy deliberately rejects ad hoc CLI variable injection in `tests/unit/server/wrangler-routing.test.ts:106-129`.

Extend `.github/workflows/preview.yml` with one scalar `fault_scenario` choice whose options are `none` plus the six exact values, and a distinct observer mode. The workflow must enforce:

- `none` produces only a normal deployment;
- one scenario produces only a fault candidate;
- observer and mutation runs keep separate concurrency groups;
- the observer checks out the exact candidate ref and starts before candidate deployment;
- the fault candidate is built, normally validated, temporarily transformed, fault-validated, and deployed from one verified commit;
- no combined scenarios and no free-form value;
- no artifact containing raw tail output is uploaded;
- no workflow or summary prints the binding value, provider output, environment identifier, deployment URL, or protected value;
- production workflow has no fault input, builder, binding, cron, or mode.

The live operator must use two independent workflow runs: one observer run and one mutation run. If the observer cannot be proven active, deployment stops.

## Rollback contract

For each scenario, use this state machine:

```text
normal verified
  -> fault observer active
  -> exact fault candidate deployed
  -> one terminal record accepted
  -> authenticated API/UI verification
  -> immutable normal candidate deployed immediately
  -> /api/health and authenticated normal status verified
  -> normal maintenance + daily backup triggers verified
  -> one-minute trigger absent
  -> fault binding absent
```

Failure at any step transitions directly to normal deployment and then to the same rollback verification. A scenario failure never authorizes a second fault candidate before normal attribution is complete.

The normal rollback artifact must be prepared and validated before the fault deployment. Record only safe fixed facts: terminal category, state, booleans for normal health/two schedules/temporary absence, and bounded timestamps. Never record a deployment URL, workflow run identifier, branch identifier, account identifier, object key, owner identifier, provider response, or raw log.

Required rollback assertions:

- `/api/health` returns the existing `{status:"ok", service:"vision"}` shape;
- authenticated `/api/diagnostics/status` returns normal owner-scoped facts;
- the rendered foundation state returns to the pre-scenario baseline;
- normal schedule inventory is exactly the maintenance and daily backup crons;
- `PREVIEW_ACCEPTANCE_FAULT_SCENARIO` is absent;
- the one-minute cron is absent;
- the generated normal artifact passes `pnpm.cmd deploy:check:preview`;
- backup key version remains 1;
- no operation deletes or scans beneath `backups/v1/`.

Operational limitation: the current workflow cannot automatically know when a separately running observer and a signed-in browser have finished. The implementation must therefore make normal rollback a separately guarded, pre-validated mutation action that the operator dispatches immediately after the terminal record, including on candidate failure. Do not claim automated rollback until a real cross-run handshake exists and is independently reviewed.

## RED-first implementation tasks

### Task 1: Strict admission and pure overlays

Files:

- Create `tests/unit/domain/temporary-preview-fault.test.ts`
- Modify `tests/unit/server/env.test.ts`
- Create `src/domain/operations/temporary-preview-fault.ts`
- Modify `src/server/env.ts`
- Modify `src/server/client-binding-boundary.ts`
- Modify `tests/security/secret-bundle.test.ts`
- Create the two mirrored source references

RED tests:

- the tuple has exactly six values in the approved order;
- each scenario parses only in preview;
- absent binding returns `null`;
- production/local plus a binding throws before any injected dependency spy runs;
- unknown, mixed-case, padded, array, object, and comma-separated values fail with a constant error that omits the supplied value;
- each diagnostic scenario replaces exactly the mapped keys;
- `r2_upload_failed` returns unmodified facts/no overlay;
- the input facts object is not mutated;
- invalid dates/facts fail closed;
- runtime environment keys remain completely classified for client scanning.

RED command:

```powershell
& .\node_modules\.bin\vitest.cmd run --project unit tests/unit/domain/temporary-preview-fault.test.ts tests/unit/server/env.test.ts tests/security/secret-bundle.test.ts
```

Expected initial failure: the temporary module/parser/binding classification does not exist.

GREEN command is identical; expected result is all selected tests passing.

### Task 2: Authenticated route boundary and AI hard-stop truthfulness

Files:

- Modify `src/server/api/diagnostic-routes.ts`
- Modify `src/domain/operations/health.ts`
- Modify `src/client/status/FoundationStatus.tsx`
- Modify `tests/unit/domain/health.test.ts`
- Modify `tests/worker/diagnostics.test.ts`
- Modify `tests/e2e/foundation-diagnostics.spec.ts`
- Update mirrored references for all modified production modules

RED Worker tests:

- unauthenticated request does not call repository owner resolution or overlay;
- authenticated wrong-owner request does not call overlay;
- each of the five diagnostic scenarios returns the exact existing response keys and expected state/warnings;
- response contains no scenario name, binding name, provider detail, repository extras, or protected fixture;
- absent overlay preserves byte-equivalent JSON for the normal fixture;
- overlay exceptions return the existing constant `DIAGNOSTICS_UNAVAILABLE` envelope;
- no new public route exists.

RED domain/browser tests:

- 950 cents returns `Action required` and `stopped`, while 799/800/900 retain their approved behavior;
- AI-stopped copy is actionable and says deterministic calendar capability remains;
- the event list remains visible for `ai_stopped`;
- all five scenarios show a non-Healthy state and expected safe copy;
- no event create/edit/move/cancel/delete control appears;
- responsive and keyboard checks remain unchanged.

Commands:

```powershell
& .\node_modules\.bin\vitest.cmd run --project unit tests/unit/domain/health.test.ts
& .\node_modules\.bin\vitest.cmd run --project worker tests/worker/diagnostics.test.ts
pnpm.cmd test:e2e -- foundation-diagnostics.spec.ts
```

Expected initial failures: 950-cent health remains `Healthy`; route dependencies have no overlay; browser fixtures do not cover deployed-shape scenario states.

### Task 3: Scheduled R2 write failure and terminal evidence

Files:

- Modify `src/jobs/create-daily-backup.ts`
- Create `src/jobs/temporary-preview-fault.ts`
- Modify `src/jobs/scheduled.ts`
- Modify `tests/integration/jobs/daily-backup.test.ts`
- Create `tests/integration/jobs/temporary-preview-fault.test.ts`
- Create/update mirrored job references

RED tests:

- normal `createDailyBackup` still invokes the extracted writer once and preserves all existing behavior;
- every diagnostic scenario emits one success/none terminal record and performs zero writer/provider/Queue/database calls;
- `r2_upload_failed` invokes only the injected failing writer;
- the injected writer throws before any provider call or mutation;
- the runner emits one failed/backup-storage-write-failed record then throws a constant scheduled error;
- an unexpected writer success or unrelated exception emits no false success;
- prior in-memory backup content and count remain unchanged;
- missing/invalid binding performs zero dependency calls;
- exact one-minute routing cannot reach role probe, restore, maintenance, or daily recovery under a fault candidate;
- normal maintenance and daily recovery routing remain unchanged.

Command:

```powershell
& .\node_modules\.bin\vitest.cmd run --project unit tests/integration/jobs/daily-backup.test.ts tests/integration/jobs/temporary-preview-fault.test.ts
```

Expected initial failure: the temporary job and shared write helper do not exist; current one-minute routing selects the role probe.

### Task 4: Closed safe-tail classifier

Files:

- Modify `scripts/safe-tail-classifier.ts`
- Modify `scripts/print-safe-tail.ts`
- Modify `tests/unit/scripts/safe-tail-classifier.test.ts`
- Modify `tests/unit/scripts/print-safe-tail.test.ts`
- Update the four mirrored script references

RED tests:

- all six exact evidence combinations classify only on the one-minute cron;
- expected scenario argument must match evidence scenario;
- wrong action/cron/evidence type/outcome/category returns no result;
- missing, extra, hidden, symbol, accessor, and prototype keys are rejected without invoking getters;
- raw private/provider-shaped text is not copied;
- duplicate same or mixed terminal records cause a closed failure instead of first-record success;
- incremental input remains bounded and clears after complete/oversized frames;
- `--fault-only` rejects unknown/combined/extra arguments;
- no matching record prints only the existing closed fallback.

Command:

```powershell
& .\node_modules\.bin\vitest.cmd run --project unit tests/unit/scripts/safe-tail-classifier.test.ts tests/unit/scripts/print-safe-tail.test.ts
```

Expected initial failure: there is no fault evidence union or `--fault-only` mode; current printer exits on the first accepted record and cannot detect a later duplicate.

### Task 5: Normal versus temporary preview artifacts and guarded workflow

Files:

- Modify `wrangler.jsonc`
- Modify `scripts/validate-preview-deploy-config.ts`
- Create `scripts/prepare-preview-fault-deploy-config.ts`
- Modify `.github/workflows/preview.yml`
- Modify `tests/unit/server/wrangler-routing.test.ts`
- Modify `tests/unit/ci/workflows.test.ts`
- Create/update mirrored script references
- Modify `docs/operations/environments.md`

RED tests:

- committed normal preview has exactly two crons and no fault binding;
- production has exactly two crons and no fault surface;
- normal generated config rejects a one-minute cron or fault binding;
- fault builder rejects normal/production/wrong/multiple scenarios and already-mutated input;
- fault builder adds exactly one binding and one one-minute cron while preserving normal config;
- workflow choices are exact and mutually exclusive;
- observer/mutation concurrency remains separate;
- observer mode cannot deploy;
- mutation mode cannot tail raw output;
- normal rollback mode is available independently of fault mode;
- deployment still uses the verified commit and generated config, not `--var`;
- workflow contains no restore secret name or application secret mapping.

Commands:

```powershell
& .\node_modules\.bin\vitest.cmd run --project unit tests/unit/server/wrangler-routing.test.ts tests/unit/ci/workflows.test.ts
pnpm.cmd build
pnpm.cmd deploy:check:preview
```

Expected initial failures: normal preview currently includes the one-minute role-probe cron; no fault builder/input/mode exists.

### Task 6: Release/privacy policy and live runbook

Files:

- Modify `tests/security/google-write-surface.test.ts`
- Modify `tests/security/secret-bundle.test.ts`
- Add focused privacy tests beside existing release scan tests
- Modify `docs/operations/phase-b-evidence.md`
- Modify `docs/operations/incident-runbook.md`
- Modify `docs/operations/environments.md`
- Modify `docs/operations/cost-review.md`

RED tests:

- fault activation cannot be found in a route, request parser, header/cookie/query lookup, Queue payload, database schema/query, model output, or client code;
- built client rejects the binding name;
- Worker/client bundles reject protected fixture values and credential-shaped canaries;
- workflow artifacts contain no raw tail or secret material;
- Google event write allowlist is unchanged;
- no new public operator route exists;
- AI stop leaves deterministic routes available and provider/context calls at zero;
- docs state observer-first, one candidate, one record, immediate normal rollback, exact two-schedule verification, and no provider-outage claim.

Commands:

```powershell
& .\node_modules\.bin\vitest.cmd run --project unit tests/security/google-write-surface.test.ts tests/security/secret-bundle.test.ts
pnpm.cmd security:scan
pnpm.cmd docs:check
```

Expected initial failures: temporary binding/bundle/workflow/privacy contracts are not represented yet.

### Task 7: Full local acceptance

Commands:

```powershell
pnpm.cmd typecheck
pnpm.cmd test:unit
pnpm.cmd test:contract
pnpm.cmd test:worker
pnpm.cmd docs:check
pnpm.cmd build
pnpm.cmd security:scan
pnpm.cmd test:e2e
pnpm.cmd check
```

Expected result: every command exits zero. A passing local suite proves code contracts only; it does not prove a live preview scenario or provider outage.

## Live acceptance matrix

| Scenario | Terminal evidence | Authenticated API check | Browser check | Non-mutation check |
|---|---|---|---|---|
| `queue_delayed` | succeeded/none | Delayed + QUEUE_DELAYED | delayed summary/action | no Queue send and no row write |
| `job_failed` | succeeded/none | Action required + FAILED_JOBS | repair action | failed-job count is overlay-only |
| `channel_expired` | succeeded/none | Action required + CHANNEL_EXPIRED | safe recovery action | no channel watch/stop |
| `database_unavailable` | succeeded/none | 200 exact status, database unavailable facts | database action | authenticated session succeeds; not evidence of Neon outage |
| `r2_upload_failed` | failed/backup_storage_write_failed | normal authenticated calendar remains readable | no false backup success | zero R2 mutations; prior backup unchanged |
| `ai_stopped` | succeeded/none | Action required, stopped, 950 | AI paused; events visible | zero paid AI/provider/context calls |

For every row, first capture a normal `Healthy` baseline, then run only that scenario, then restore and verify normal before advancing.

## Security and privacy checks

Implementation review must prove:

- strict preview-only scalar admission before scenario-specific dependency construction;
- production rejection for all six values;
- session and owner checks precede overlay access;
- overlay is pure, copy-on-write, content-free, and incapable of I/O;
- R2 failure port throws before provider mutation;
- existing exact diagnostic schema remains unchanged;
- no response/log/evidence includes scenario binding metadata beyond the allowlisted evidence enum;
- no provider exception or driver error text is serialized;
- no credentials, OAuth values, cookies, emails, owner/event/provider identifiers, URLs, object keys, raw rows, ciphertext, plaintext samples, hashes of protected content, or connection strings enter output;
- no test root key, fixed credential, protected fixture, sentinel value, or authorization bypass enters deployable bundles;
- no event-level Google write route or provider call is added;
- classifier handles hostile object shapes and duplicate/mixed records;
- normal preview and production artifacts contain neither the binding nor one-minute cron;
- backup key version remains 1 and encrypted daily backups are untouched.

## Final cleanup contract

The cleanup is a new reviewed commit from the post-acceptance evidence head. Do not reset to an older commit.

### Delete current temporary role-probe surfaces

- `src/data/backup/temporary-preview-role-probe-adapter.ts`
- `src/jobs/temporary-preview-role-probe.ts`
- `tests/integration/backup/temporary-preview-role-probe-adapter.test.ts`
- `tests/integration/jobs/temporary-preview-role-probe.test.ts`
- `docs/reference/simple/src/data/backup/temporary-preview-role-probe-adapter.md`
- `docs/reference/technical/src/data/backup/temporary-preview-role-probe-adapter.md`
- `docs/reference/simple/src/jobs/temporary-preview-role-probe.md`
- `docs/reference/technical/src/jobs/temporary-preview-role-probe.md`

### Delete current temporary fenced-restore runtime surfaces

- `src/data/backup/temporary-preview-clear-adapter.ts`
- `src/data/backup/r2-restore-attempt-store.ts`
- `src/jobs/temporary-preview-restore.ts`
- `tests/integration/backup/temporary-preview-clear-adapter.test.ts`
- `tests/integration/backup/r2-restore-attempt-store.test.ts`
- `tests/integration/jobs/temporary-preview-restore.test.ts`
- their six simple/technical mirrored references

### Delete planned fault-only surfaces

- `src/domain/operations/temporary-preview-fault.ts`
- `src/jobs/temporary-preview-fault.ts`
- `scripts/prepare-preview-fault-deploy-config.ts`
- `tests/unit/domain/temporary-preview-fault.test.ts`
- `tests/integration/jobs/temporary-preview-fault.test.ts`
- all simple/technical references created only for those three files
- browser/Worker/policy cases that exist only to prove temporary scenario reachability

### Surgically modify shared files

- `src/server/api/diagnostic-routes.ts`: remove the optional overlay dependency, production parser use, and transform call; preserve authentication, owner scope, exact response, measured usage, and all ordinary routes.
- `src/server/env.ts`: remove temporary role-probe/Worker-restore/fault fields and schemas; preserve permanent runtime, backup, OAuth, AI, and measured-warning configuration.
- `src/server/client-binding-boundary.ts`: remove temporary runtime names only after the runtime schema removes them; preserve complete client classification.
- `src/jobs/scheduled.ts`: remove role-probe/fenced-restore/fault imports, dependency slots, emitters, and one-minute dispatch; preserve normal maintenance and daily recovery.
- `scripts/safe-tail-classifier.ts`: remove role-probe/restore/fault evidence unions and locators; preserve bounded framing plus permanent normal maintenance/recovery closed classification.
- `scripts/print-safe-tail.ts`: remove `--role-probe-only`, `--restore-only` only if no retained offline operation uses them, and always remove `--fault-only`; preserve the permanent ordinary evidence mode and closed fallback.
- `.github/workflows/preview.yml`: remove role-probe/restore/fault inputs, builder call, and temporary observer modes; preserve observer/mutation concurrency separation, bounded timeouts, immutable ref verification, normal deployment, and permanent normal safe-tail mode.
- `wrangler.jsonc`: require exactly the two normal crons in local/preview/production and no temporary binding.
- `scripts/validate-preview-deploy-config.ts`: require exactly the normal preview artifact and reject all temporary residue.
- `tests/unit/server/wrangler-routing.test.ts` and `tests/unit/ci/workflows.test.ts`: replace temporary reachability assertions with permanent absence and two-schedule assertions.
- `tests/unit/scripts/safe-tail-classifier.test.ts` and `tests/unit/scripts/print-safe-tail.test.ts`: delete temporary evidence cases but retain hostile-object, framing, boundedness, closed-failure, and ordinary-evidence tests.
- `tests/security/secret-bundle.test.ts`: remove temporary runtime-schema expectations while retaining Worker/client protected-value scanning.
- `docs/operations/secrets.md`: move the two deleted Worker restore secrets out of the active inventory; preserve credential lifecycle history.
- `docs/operations/restore-drill.md`, `docs/operations/phase-b-evidence.md`, and `docs/operations/credential-change-log.md`: record completed cleanup without erasing historical evidence.
- regenerate/update mirrored references for every modified retained production/script file.

### Retain permanent recovery and evidence surfaces

- `src/data/backup/import-backup.ts`
- `src/data/backup/neon-adapter.ts`
- `scripts/restore-backup.ts`
- `tests/integration/backup/restore-command.test.ts`
- `tests/integration/backup/round-trip.test.ts`
- `tests/integration/backup/schema-contract.test.ts`
- `docs/operations/backup-and-restore.md`
- permanent Worker/client protected-value scanning
- the extracted normal backup write classification helper
- normal maintenance evidence and its classifier
- measured database/R2 warnings
- observer/mutation separation and bounded timeouts
- the 950-cent AI hard-stop policy, deterministic-route survival, and safe UI copy
- the two normal schedules
- backup key version 1 and every encrypted daily backup
- historical plans/specs, setback records, credential lifecycle, restore evidence, and release evidence

`PREVIEW_RESTORE_DATABASE_URL` and `PREVIEW_RESTORE_TARGET_ID` may remain documented as operator-only environment variables for the retained offline restore command. They must be absent from Worker runtime schemas, Worker secrets, deploy configs, workflows, generated Worker bundles, and active secret inventory.

### Acceptance-probe cleanup boundary

No Phase B foundation-probe source exists in the inspected snapshot. At the final cleanup head, enumerate its actual implementation paths before editing:

```powershell
git grep -l -I -e 'vision.phase-b-foundation-probe/v1' -e 'phase-b-foundation-probe' -e 'PREVIEW_ACCEPTANCE_' -- src tests scripts .github wrangler.jsonc docs/reference
```

Delete only the temporary probe job/adapter/schema/workflow/references and tests that exist solely for reachability. Preserve measured usage sources, normal maintenance evidence, and permanent aggregate contracts explicitly listed by the approved cleanup amendment.

### Permanent cleanup residue test

Create and retain `tests/security/temporary-surface-cleanup.test.ts`. It must:

- assert deleted source/test/reference files do not exist;
- assert `src`, `.github/workflows`, `wrangler.jsonc`, and generated Worker config contain no temporary role-probe, Worker-restore, fault, acceptance-probe binding, or one-minute routing;
- exclude historical specs/plans, credential lifecycle evidence, setback evidence, and the retained offline restore script/docs from broad text scans;
- assert normal preview and production configs contain exactly two schedules;
- assert the Worker bundle contains none of the deleted temporary binding names or fixture values;
- assert the client bundle still passes the permanent forbidden-binding scan;
- assert `scripts/restore-backup.ts` and its focused tests still exist;
- assert backup key version remains 1 by configuration, without reading the key;
- never list, read, or delete R2 objects.

Cleanup RED command:

```powershell
& .\node_modules\.bin\vitest.cmd run --project unit tests/security/temporary-surface-cleanup.test.ts
```

Expected RED before cleanup: current role-probe/restore files and planned fault surfaces are present.

Cleanup GREEN and full commands:

```powershell
& .\node_modules\.bin\vitest.cmd run --project unit tests/security/temporary-surface-cleanup.test.ts tests/unit/server/wrangler-routing.test.ts tests/unit/ci/workflows.test.ts tests/unit/scripts/safe-tail-classifier.test.ts tests/unit/scripts/print-safe-tail.test.ts tests/security/secret-bundle.test.ts
pnpm.cmd docs:check
pnpm.cmd build
pnpm.cmd security:scan
pnpm.cmd test:e2e
pnpm.cmd check
```

Expected result: all commands pass; the exact cleanup commit is then deployed as the normal Worker and verified before provider cleanup.

## Provider cleanup order

Source cleanup and provider cleanup are separate gates:

1. deploy the reviewed source cleanup and verify normal authenticated health;
2. verify exactly the maintenance and daily backup schedules;
3. verify all temporary Worker bindings/secrets are absent;
4. verify destructive restore code is inactive;
5. only then delete the opaque restore-attempt marker;
6. reconfirm disposable-database deletion preconditions;
7. only then permanently delete the attested disposable branch;
8. never delete or rotate backup key version 1;
9. never delete `backups/v1/`.

No provider mutation is authorized by this report.

## Plan self-review

Spec coverage:

- exactly six scenarios: covered by one shared tuple and workflow choice;
- authenticated/owner-first overlays: covered by the confirmed route boundary and Worker RED tests;
- existing diagnostic schema: preserved and explicitly tested;
- scheduled R2 boundary: isolated at the writer before mutation;
- AI real 950-cent policy/non-AI availability: covered with a permanent truthfulness resolution;
- observer, one record, rollback, two schedules, temporary absence: covered by workflow and rollback contracts;
- hostile classifier/privacy/bundle checks: covered;
- final surgical cleanup and retention: exact current/planned paths mapped;
- provider cleanup order: separated from source cleanup.

Known planning constraint:

- immediate rollback remains operator-coordinated because the separate observer and authenticated browser do not currently provide a reviewed cross-run completion signal to the mutation workflow. The plan does not mislabel this as automated.

Type/signature consistency:

- one `PreviewFaultScenario` type is shared by parser, overlay, job, builder, evidence, and classifier;
- one `TemporaryPreviewFaultEvidence` shape is shared by emitter and classifier;
- one `overlayFoundationFacts` signature is used only between owner admission and health calculation;
- one extracted `BackupObjectWriter` boundary is used by normal backup and temporary R2 failure.

Placeholder scan:

- no unspecified implementation step is required for the fault/cleanup slice;
- the not-yet-existing foundation probe is handled through an exact post-implementation discovery command rather than invented paths.

## Privacy scan report

Executed locally on 2026-07-28 against this report. Results:

| Sensitive-value pattern | Matches |
|---|---:|
| Email-address syntax | 0 |
| HTTP/provider URL value syntax | 0 |
| PostgreSQL/Neon URI syntax | 0 |
| Bearer credential value syntax | 0 |
| Quoted credential assignment syntax | 0 |
| Placeholder plan language | 0 |

Required implementation scan targets:

- this report;
- changed logger/classifier/workflow artifacts;
- generated Worker bundle;
- generated client bundle;
- closed workflow evidence.

Report acceptance requires zero matches for:

- email-address syntax;
- HTTP/provider URL values;
- PostgreSQL/database URI syntax;
- OAuth authorization codes/tokens/cookies;
- credential/key assignments or long credential-shaped values;
- protected calendar titles/descriptions/attendees/locations;
- concrete owner/event/provider/object identifiers;
- raw provider exceptions or stack traces.

Allowlisted technical names such as binding names, enum values, source paths, fixed evidence types, fixed cron strings, backup prefix policy, and constant public error categories are design metadata, not secret values.

## Permanent post-acceptance closure order

This section supersedes every older marker-first cleanup instruction. The only
approved order is:

1. reviewed Task 9 cleanup is deployed;
2. normal health, signed-in reads, exactly two schedules, and temporary absence are proved;
3. disposable branch deletion and absence are proved;
4. replay marker is deleted last.

Provider deletion is manual. No workflow receives a deletion operation. If
branch deletion or its absence proof is uncertain, retain the replay marker and
stop. Backup key version 1 is retained and is not rotated.
