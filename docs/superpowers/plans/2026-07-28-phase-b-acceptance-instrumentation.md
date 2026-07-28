# Phase B Acceptance Instrumentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce privacy-safe, reviewable evidence for every remaining Phase B completion gate, then remove every temporary acceptance surface while retaining permanent maintenance telemetry and measured storage warnings.

**Architecture:** Extend only confirmed live paths: the scheduled Worker, authenticated diagnostics, existing database/R2 backup boundaries, and the guarded preview workflow. Permanent code emits closed maintenance evidence and measured warnings. Temporary preview-only code runs aggregate probes and six reversible fault scenarios behind a strict deployment binding and one-minute candidate schedule. Every candidate is observed first, produces one terminal record, and is followed by the immutable normal Worker.

**Tech Stack:** TypeScript, React, Hono, Cloudflare Workers/Queues/R2, Neon PostgreSQL, Drizzle ORM, Zod, Vitest, Playwright, GitHub Actions, Wrangler, pnpm.

## Global Constraints

- Work only on `codex/phase-b-foundation` in the existing Phase B worktree.
- Use a fresh implementation subagent and a separate independent reviewer for every task.
- Follow RED, GREEN, refactor. Expected RED failures are test evidence, not setbacks.
- Do not add a schema migration.
- Do not add a public operator route or any Google event create, edit, move, cancel, or delete capability.
- Do not add, rotate, reveal, or request a secret.
- Never print URLs, connection strings, authorization codes, tokens, cookies, emails, provider identifiers, object keys, event content, raw rows, ciphertext, or provider error text.
- Keep `BACKUP_ENCRYPTION_KEY` unchanged at version 1.
- Never delete `backups/v1/`.
- Normal preview and production must have exactly the 15-minute maintenance cron and daily backup cron.
- Temporary acceptance is preview-only, one scenario per candidate, observer-first, one terminal record, then immediate normal rollback.
- The strict scenario enum is exactly:
  `queue_delayed`, `job_failed`, `channel_expired`,
  `database_unavailable`, `r2_upload_failed`, `ai_stopped`.
- Approved non-secret warning thresholds are:
  `DATABASE_USAGE_WARNING_BYTES=400000000`,
  `R2_USAGE_WARNING_BYTES=8000000000`,
  `R2_USAGE_WARNING_OBJECTS=100`.
- Current-state database/privacy assertions plus pure policy tests and the controlled disposable exercise are truthful evidence; do not describe them as a complete historical privacy-decision audit.
- The guarded workflow, not the Worker, verifies the Cloudflare AI Gateway limit and passes only a same-run non-secret boolean attestation.
- Update both simple and technical reference documentation for every created or changed production file and named export.
- Log every unexpected failure or incorrect hypothesis through the setback logger before continuing.

---

## Task 1: Emit Permanent Calendar-Maintenance Evidence

**Files:**

- Create: `src/jobs/calendar-maintenance-evidence.ts`
- Create: `tests/unit/jobs/calendar-maintenance-evidence.test.ts`
- Modify: `src/jobs/repair-calendar-sync.ts`
- Modify: `src/jobs/renew-google-channels.ts`
- Modify: `src/jobs/scheduled.ts`
- Modify: `tests/integration/jobs/repair-sync.test.ts`
- Modify: `tests/unit/jobs/channel-renewal.test.ts`
- Modify: `tests/integration/jobs/channel-maintenance-adversarial.test.ts`
- Modify: `scripts/safe-tail-classifier.ts`
- Modify: `scripts/print-safe-tail.ts`
- Modify: `tests/unit/scripts/safe-tail-classifier.test.ts`
- Modify: `tests/unit/scripts/print-safe-tail.test.ts`
- Modify: `.github/workflows/preview.yml`
- Modify: `tests/unit/ci/workflows.test.ts`
- Modify: `docs/operations/phase-b-evidence.md`
- Create/modify the matching files under:
  `docs/reference/simple/src/jobs/`,
  `docs/reference/technical/src/jobs/`,
  `docs/reference/simple/scripts/`, and
  `docs/reference/technical/scripts/`.

### Step 1: Write the RED coordinator and evidence tests

- [ ] Define the expected exact interface in tests:

```ts
export interface CalendarMaintenanceEvidence {
  readonly evidenceType: "vision.calendar-maintenance/v1";
  readonly outcome: "succeeded" | "failed";
  readonly category:
    | "none"
    | "repair_failed"
    | "renewal_failed"
    | "repair_and_renewal_failed";
  readonly repairOutcome: "reserved" | "no_work" | "failed";
  readonly renewalOutcome: "completed" | "no_work" | "failed";
}
```

- [ ] Test all success/failure combinations, exact five-key reconstruction,
  one emission, cleanup/repair/renewal execution ordering, and original thrown
  object precedence.
- [ ] Test that cleanup failure maps to the repair side without adding a sixth
  evidence field.
- [ ] Test `repairCalendarSync()` returns `reserved` or `no_work`.
- [ ] Test `renewExpiringChannels()` returns `completed` or `no_work`.
- [ ] Keep real PGlite concurrency and lifecycle tests intact.

Run:

```powershell
pnpm.cmd exec vitest run --project unit tests/unit/jobs/calendar-maintenance-evidence.test.ts tests/integration/jobs/repair-sync.test.ts tests/unit/jobs/channel-renewal.test.ts tests/integration/jobs/channel-maintenance-adversarial.test.ts
```

Expected RED: the new module is unresolved, coordinator results are
`undefined`, scheduler types still use `Promise<void>`, and no evidence is
emitted.

### Step 2: Implement the evidence and coordinator results

- [ ] Create a closed evidence constructor and fixed
  `{ action: "calendar.maintenance", evidence }` emitter.
- [ ] Return `reserved` only when repair work was durably reserved for enqueue.
- [ ] Return `completed` only when renewal or deferred cleanup work was selected.
- [ ] Make `runScheduledCalendarMaintenance()` attempt cleanup, repair, and
  renewal; emit once; then rethrow the original cleanup, repair, or renewal
  failure in current precedence.
- [ ] Do not serialize errors or counts tied to an owner, calendar, channel, or
  provider resource.

Run the focused command again.

Expected GREEN: all focused tests pass and current lifecycle semantics remain
unchanged.

### Step 3: Harden safe-tail and the observer

- [ ] Add `classifyCalendarMaintenanceEvidence()`.
- [ ] Accept only exact own-enumerable data keys on the normal maintenance cron.
- [ ] Reject accessors, symbols, prototypes, hidden/extra keys, duplicate or
  mixed terminal records, wrong crons, incoherent enums, and raw error fields.
- [ ] Add `--calendar-maintenance-only` to `print-safe-tail.ts`.
- [ ] Keep the one-MiB incremental frame bound and raw-line non-retention.
- [ ] Make the observer workflow check out the supplied immutable ref, remain
  non-mutating, and use its separate concurrency group and bounded timeout.

Run:

```powershell
pnpm.cmd exec vitest run --project unit tests/unit/scripts/safe-tail-classifier.test.ts tests/unit/scripts/print-safe-tail.test.ts tests/unit/ci/workflows.test.ts
pnpm.cmd typecheck
pnpm.cmd docs:check
```

Expected GREEN: focused tests, typecheck, and documentation coverage pass.

### Step 4: Commit and independently review

- [ ] Review for exact spec compliance, privacy, failure precedence, and
  absence of provider/event capability.
- [ ] Fix every Critical or Important finding and obtain clean re-review.
- [ ] Commit:

```powershell
git add src tests scripts .github docs
git commit -m "feat: emit safe calendar maintenance evidence"
```

---

## Task 2: Replace Static Storage Warnings with Measured Inputs

**Files:**

- Create: `src/domain/operations/usage-warnings.ts`
- Create: `src/data/usage-warning-source.ts`
- Create: `tests/unit/domain/usage-warnings.test.ts`
- Create: `tests/integration/data/usage-warning-source.test.ts`
- Modify: `src/data/repositories/diagnostic-repository.ts`
- Modify: `src/server/api/diagnostic-routes.ts`
- Modify: `src/server/env.ts`
- Modify: `src/server/client-binding-boundary.ts`
- Modify: `wrangler.jsonc`
- Modify: `scripts/validate-preview-deploy-config.ts`
- Modify: `tests/integration/data/diagnostic-repository.test.ts`
- Modify: `tests/worker/diagnostics.test.ts`
- Modify: `tests/unit/server/env.test.ts`
- Modify: `tests/unit/server/env-zeroization.test.ts`
- Modify: `tests/unit/server/wrangler-routing.test.ts`
- Modify: `tests/security/secret-bundle.test.ts`
- Modify: `docs/operations/cost-review.md`
- Modify matching simple/technical references.

### Step 1: Write RED policy and adapter tests

- [ ] Define:

```ts
export interface UsageMeasurements {
  readonly databaseBytes: number;
  readonly r2ObjectCount: number;
  readonly r2Bytes: number;
}

export interface UsageWarnings {
  readonly databaseUsageWarning: boolean;
  readonly r2UsageWarning: boolean;
}

export interface UsageWarningSource {
  readUsageWarnings(): Promise<UsageWarnings>;
}
```

- [ ] Test exact boundary values immediately below, equal to, and above all
  three approved thresholds.
- [ ] Reject negative, fractional, unsafe, overflowing, repeated-cursor, and
  over-page measurements.
- [ ] Test a read-only database-size query and bounded R2 pagination.
- [ ] Test that measurement failure fails safe as an actionable warning and
  never silently returns two false values.
- [ ] Test that no R2 key, cursor, metadata, or provider error leaves the source.
- [ ] Test environment values are required positive safe integers in preview
  and production and rejected from client bindings.

Run:

```powershell
pnpm.cmd exec vitest run --project unit tests/unit/domain/usage-warnings.test.ts tests/integration/data/usage-warning-source.test.ts tests/integration/data/diagnostic-repository.test.ts tests/worker/diagnostics.test.ts tests/unit/server/env.test.ts tests/unit/server/wrangler-routing.test.ts
```

Expected RED: the policy/source modules do not exist and production diagnostics
still inject hard-coded false values.

### Step 2: Implement the policy and production source

- [ ] Keep threshold comparison pure in `usage-warnings.ts`.
- [ ] Read `pg_database_size(current_database())` through a read-only aggregate.
- [ ] List R2 with a fixed prefix and explicit page/object/byte admission caps.
- [ ] Count bytes and objects without returning object identities.
- [ ] Inject `UsageWarningSource` into the diagnostic repository.
- [ ] Resolve warnings during `readFoundationFacts()`; preserve owner-scoped
  status facts and the exact public response shape.
- [ ] Wire the approved non-secret values in all deployable environments.
- [ ] Preserve authentication before owner repository access.

Run the focused command again, then:

```powershell
pnpm.cmd typecheck
pnpm.cmd docs:check
pnpm.cmd build
pnpm.cmd security:scan
```

Expected GREEN: measured warnings replace both hard-coded values, all commands
exit zero, and bundles contain no server-only binding values.

### Step 3: Commit and independently review

- [ ] Review boundary arithmetic, pagination caps, unavailable behavior,
  authentication order, client exclusion, and documentation.
- [ ] Fix and re-review every Critical or Important finding.
- [ ] Commit:

```powershell
git add src tests scripts wrangler.jsonc docs
git commit -m "feat: measure foundation storage usage"
```

---

## Task 3: Add the Temporary Read-Only Foundation Probe

**Files:**

- Create: `src/domain/operations/phase-b-privilege-manifest.ts`
- Create: `src/data/phase-b-foundation-probe.ts`
- Create: `src/jobs/phase-b-foundation-probe.ts`
- Create: `tests/unit/domain/phase-b-privilege-manifest.test.ts`
- Create: `tests/integration/data/phase-b-foundation-probe.test.ts`
- Create: `tests/integration/jobs/phase-b-foundation-probe.test.ts`
- Modify: `src/jobs/scheduled.ts`
- Modify: `scripts/safe-tail-classifier.ts`
- Modify: `scripts/print-safe-tail.ts`
- Modify their focused tests.
- Create matching simple/technical references.

### Step 1: Write RED invariant and evidence tests

- [ ] Encode the exact reviewed 29-table application-role privilege allowlist
  from the migration-9 schema and deployed-role attestation.
- [ ] Test schema, columns, role, effective privileges, grant options, owners,
  and zero `PUBLIC` grants.
- [ ] Test owner-scoped identity, domain, privacy-floor, provenance, reference,
  checkpoint, provider-revision, and protected-column violation counts.
- [ ] Test one max-one client, one release, and one pool close on every path.
- [ ] Test only parameterized SQL and no mutation/locking/provider calls.
- [ ] Test zero, one, and multiple eligible sentinel rows.
- [ ] Test controlled plaintext bytes are cleared in `finally`.
- [ ] Test bounded R2 listing, required-date backup, exact metadata keys,
  supported format/key version, checksum/digest/envelope shape, and no put/delete.
- [ ] Do not parse `BACKUP_ENCRYPTION_KEY` in reporting code.
- [ ] Define the exact evidence from the approved specification:

```ts
export interface PhaseBFoundationProbeEvidence {
  readonly evidenceType: "vision.phase-b-foundation-probe/v1";
  readonly outcome: "succeeded" | "failed";
  readonly category:
    | "none"
    | "configuration_invalid"
    | "database_unavailable"
    | "r2_unavailable"
    | "numeric_bound_exceeded"
    | "role_mismatch"
    | "schema_mismatch"
    | "privilege_mismatch"
    | "public_grants_present"
    | "identity_violation"
    | "domain_violation"
    | "privacy_violation"
    | "provenance_violation"
    | "reference_violation"
    | "checkpoint_violation"
    | "protected_storage_mismatch"
    | "sentinel_failed"
    | "backup_contract_mismatch";
  readonly roleMatches: boolean;
  readonly schemaMatches: boolean;
  readonly privilegesMatch: boolean;
  readonly publicGrantCount: number;
  readonly identityViolations: number;
  readonly domainViolations: number;
  readonly privacyViolations: number;
  readonly provenanceViolations: number;
  readonly referenceViolations: number;
  readonly checkpointViolations: number;
  readonly protectedStorageMatches: boolean;
  readonly sentinelStatus: "passed" | "failed" | "not_tested";
  readonly backupContractMatches: boolean;
  readonly databaseBytes: number;
  readonly r2ObjectCount: number;
  readonly r2Bytes: number;
}
```

Run:

```powershell
pnpm.cmd exec vitest run --project unit tests/unit/domain/phase-b-privilege-manifest.test.ts tests/integration/data/phase-b-foundation-probe.test.ts tests/integration/jobs/phase-b-foundation-probe.test.ts tests/unit/scripts/safe-tail-classifier.test.ts tests/unit/scripts/print-safe-tail.test.ts
```

Expected RED: all three modules are missing and the classifier does not know
the foundation evidence schema.

### Step 2: Implement aggregate-only database and R2 adapters

- [ ] Derive signature expectations from production schema contracts rather
  than a test-only duplicate.
- [ ] Admit every integer before addition or serialization.
- [ ] Emit one deterministic category using the interface order above.
- [ ] Return `not_tested` for absent or ambiguous sentinel evidence.
- [ ] If exactly one disposable synchronized event is eligible in the bounded
  window, decrypt only the controlled field, compare mutable bytes internally,
  and clear them in `finally`.
- [ ] Never emit a sentinel-derived hash, sample, identity, or count beyond the
  approved bounded aggregates.
- [ ] Reconstruct exact evidence in safe-tail and reject hostile shapes,
  duplicates, mixed evidence, wrong cron, and raw errors.

Run the focused command and:

```powershell
pnpm.cmd typecheck
pnpm.cmd docs:check
pnpm.cmd security:scan
```

Expected GREEN: all commands pass; migration diff remains empty.

### Step 3: Commit and independently review

- [ ] Obtain independent database/security review of every query, privilege
  expectation, R2 bound, sentinel buffer, and cleanup path.
- [ ] Fix and re-review every Critical or Important finding.
- [ ] Commit:

```powershell
git add src tests scripts docs
git commit -m "feat: add preview foundation acceptance probe"
```

---

## Task 4: Produce Exact AI Usage Evidence

**Files:**

- Create: `src/data/phase-b-ai-usage-source.ts`
- Create: `src/jobs/phase-b-ai-usage-evidence.ts`
- Create: `tests/integration/data/phase-b-ai-usage-source.test.ts`
- Create: `tests/integration/jobs/phase-b-ai-usage-evidence.test.ts`
- Modify: `src/domain/budget/ai-budget.ts`
- Modify: `src/domain/operations/health.ts`
- Modify: `tests/unit/domain/ai-budget.test.ts`
- Modify: `tests/unit/domain/health.test.ts`
- Modify: `scripts/configure-ai-gateway-budget.ts`
- Modify: `tests/unit/scripts/configure-ai-gateway-budget.test.ts`
- Modify scheduled/classifier/printer seams and focused tests.
- Create/modify matching simple/technical references.

### Step 1: Write RED tier, ledger, and Gateway tests

- [ ] Export one shared `classifyAiSpendTier()` used by health and evidence.
- [ ] Test 799, 800, 899, 900, 949, 950 and invalid integers.
- [ ] Test:

```text
monthlyCents =
  ai_usage_months.settled_cents +
  ai_usage_months.reserved_cents
```

- [ ] Test zero-row consistency, settled/reserved totals, owner/month mismatch,
  invalid transitions, malformed cells, and overflow.
- [ ] Add a read-only Gateway verifier beside the existing configurator.
- [ ] Prove the verifier performs only list/detail reads and no mutation method.
- [ ] Define exact `vision.ai-usage/v1` evidence with fixed 800/900/950 values,
  `gatewayLimitMatches`, and `nonAiAvailable`.
- [ ] Exactly 950 is `stopped` and successful evidence; above 950 is
  `limit_exceeded`.

Run:

```powershell
pnpm.cmd exec vitest run --project unit tests/integration/data/phase-b-ai-usage-source.test.ts tests/integration/jobs/phase-b-ai-usage-evidence.test.ts tests/unit/domain/ai-budget.test.ts tests/unit/domain/health.test.ts tests/unit/scripts/configure-ai-gateway-budget.test.ts tests/unit/scripts/safe-tail-classifier.test.ts
```

Expected RED: the source/job/shared tier/read-only verifier do not exist.

### Step 2: Implement and compose the safe evidence

- [ ] Keep owner/month SQL parameterized and aggregate-only.
- [ ] Do not return reservation, ledger, request, model, or token identifiers.
- [ ] Use the same guarded workflow run to verify one exact enabled, unscoped,
  rolling 30-day 950-cent Gateway limit.
- [ ] Pass only a generated non-secret true attestation to the temporary candidate.
- [ ] Emit `unavailable`, `inconsistent`, or `limit_exceeded` without raw errors.
- [ ] Prove deterministic status and calendar reads remain available at AI stop.
- [ ] Reconstruct exact evidence in the classifier and reject hostile or duplicate
  terminal records.

Run the focused command and:

```powershell
pnpm.cmd typecheck
pnpm.cmd docs:check
pnpm.cmd build
pnpm.cmd security:scan
```

Expected GREEN: all commands pass and the configurator's existing write behavior
is unchanged outside the new read-only verification function.

### Step 3: Commit and independently review

- [ ] Review ledger arithmetic, tier boundaries, no-mutation Gateway verification,
  exact evidence, non-AI availability, and secret separation.
- [ ] Fix and re-review all Critical or Important findings.
- [ ] Commit:

```powershell
git add src tests scripts docs
git commit -m "feat: emit safe Phase B AI usage evidence"
```

---

## Task 5: Add the Six Preview-Only Fault Scenarios

**Files:**

- Create: `src/domain/operations/temporary-preview-fault.ts`
- Create: `src/jobs/temporary-preview-fault.ts`
- Create: `tests/unit/domain/temporary-preview-fault.test.ts`
- Create: `tests/integration/jobs/temporary-preview-fault.test.ts`
- Modify: `src/server/env.ts`
- Modify: `src/server/api/diagnostic-routes.ts`
- Modify: `src/jobs/create-daily-backup.ts`
- Modify: `src/jobs/scheduled.ts`
- Modify: `tests/worker/diagnostics.test.ts`
- Modify: `tests/integration/jobs/daily-backup.test.ts`
- Modify: `tests/e2e/foundation-diagnostics.spec.ts`
- Modify: `scripts/safe-tail-classifier.ts`
- Modify: `scripts/print-safe-tail.ts`
- Modify focused tests and matching references.

### Step 1: Write RED scenario admission and overlay tests

- [ ] Define one frozen six-value enum and
  `parseTemporaryPreviewFaultScenario()`.
- [ ] Accept only an exact scalar binding when `VISION_ENV === "preview"`.
- [ ] Reject missing, unknown, multiple, malformed, or production configuration
  before database, R2, Queue, Google, AI, or diagnostics access.
- [ ] Prove the browser cannot activate a scenario through a route, query,
  header, cookie, body, Queue message, database row, or model output.
- [ ] Apply copy-on-write overlays only after session and owner admission:

| Scenario | Safe overlay |
|---|---|
| `queue_delayed` | old queued-job timestamp producing `Delayed` |
| `job_failed` | one failed job producing `Action required` |
| `channel_expired` | expired channel producing `Action required` |
| `database_unavailable` | database availability false after authentication |
| `ai_stopped` | real 950-cent tier, AI stopped, non-AI reads intact |

- [ ] Test unauthenticated and wrong-owner rejection occurs before overlay use.
- [ ] Preserve the existing exact diagnostics JSON keys and UI accessibility.

Run:

```powershell
pnpm.cmd exec vitest run --project unit tests/unit/domain/temporary-preview-fault.test.ts tests/worker/diagnostics.test.ts tests/e2e/foundation-diagnostics.spec.ts
```

Expected RED: the enum/parser/overlay do not exist and deployed-shape fault
states cannot be selected.

### Step 2: Isolate the R2 failure boundary

- [ ] Extract the narrow backup object writer used by normal backup creation.
- [ ] Inject a constant preview test writer for `r2_upload_failed`.
- [ ] Throw before any R2 `put` call or object mutation.
- [ ] Preserve prior valid backups and never claim backup success.
- [ ] Emit one exact `vision.preview-fault/v1` failed
  `backup_storage_write_failed` record and then preserve scheduled failure.
- [ ] For `job_failed`, `channel_expired`, and `database_unavailable`, emit one
  exact successful content-free fault record.
- [ ] Use the `queue_delayed` candidate's one terminal slot for the exact
  foundation-probe record.
- [ ] Use the `ai_stopped` candidate's one terminal slot for the exact AI-usage
  record.
- [ ] Thus every candidate deployment emits exactly one terminal record.

Run:

```powershell
pnpm.cmd exec vitest run --project unit tests/integration/jobs/daily-backup.test.ts tests/integration/jobs/temporary-preview-fault.test.ts tests/unit/scripts/safe-tail-classifier.test.ts tests/unit/scripts/print-safe-tail.test.ts
```

Expected GREEN: normal backup behavior passes; the failure boundary performs
zero provider mutations; all scenario-to-record mappings are exact.

### Step 3: Prove API and rendered UI states

- [ ] Test all five authenticated overlays through the Worker.
- [ ] Test the R2 failure leaves authenticated calendar reads normal.
- [ ] Test every unhealthy scenario avoids `Healthy` and renders actionable
  fixed copy.
- [ ] Test AI stop leaves event viewing available and makes zero paid AI calls.
- [ ] Test no event-write controls or routes appear.

Run:

```powershell
pnpm.cmd test:worker
pnpm.cmd test:e2e
pnpm.cmd typecheck
pnpm.cmd docs:check
```

Expected GREEN: Worker and Chromium suites pass with exact safe states.

### Step 4: Commit and independently review

- [ ] Review authentication ordering, pure overlays, R2 pre-mutation failure,
  scenario cardinality, exact schemas, and Phase C exclusion.
- [ ] Fix and re-review all Critical or Important findings.
- [ ] Commit:

```powershell
git add src tests scripts docs
git commit -m "feat: add guarded preview fault scenarios"
```

---

## Task 6: Build the Guarded Candidate and Permanent Cleanup Contract

**Files:**

- Create: `scripts/prepare-preview-fault-deploy-config.ts`
- Create: `tests/security/temporary-surface-cleanup.test.ts`
- Modify: `wrangler.jsonc`
- Modify: `scripts/validate-preview-deploy-config.ts`
- Modify: `.github/workflows/preview.yml`
- Modify: `tests/unit/server/wrangler-routing.test.ts`
- Modify: `tests/unit/ci/workflows.test.ts`
- Modify: `tests/security/google-write-surface.test.ts`
- Modify: `tests/security/secret-bundle.test.ts`
- Modify: `docs/operations/environments.md`
- Modify: `docs/operations/incident-runbook.md`
- Modify: `docs/operations/phase-b-evidence.md`
- Modify: `docs/operations/cost-review.md`
- Modify matching script references.

### Step 1: Write RED config and workflow tests

- [ ] Assert committed normal local/preview/production config has two crons and
  no acceptance binding.
- [ ] Build a generated preview artifact that adds exactly one strict scenario
  and one one-minute cron.
- [ ] Reject production, unknown/multiple scenario values, existing mutation,
  missing normal crons, or a committed temporary binding.
- [ ] Add exact workflow choices for observer, candidate deploy, and normal
  rollback; make them mutually exclusive.
- [ ] Preserve observer/mutation concurrency separation and 16/18-minute bounds.
- [ ] Require observer proof before candidate deployment.
- [ ] Deploy generated config at an immutable reviewed ref without `--var`.
- [ ] Run the read-only Gateway verifier only for `ai_stopped`.
- [ ] Restore the immutable normal Worker after every success or failure.
- [ ] Verify normal health, exactly two schedules, and absence of the temporary
  binding/one-minute cron before advancing.

Run:

```powershell
pnpm.cmd exec vitest run --project unit tests/unit/server/wrangler-routing.test.ts tests/unit/ci/workflows.test.ts
pnpm.cmd build
pnpm.cmd deploy:check:preview
```

Expected RED: the builder and exact workflow modes do not exist.

### Step 2: Add release/privacy and cleanup residue coverage

- [ ] Assert no scenario activation in routes, client code, schemas, Queue
  payloads, or AI output.
- [ ] Assert no public operator or Google event-write route.
- [ ] Scan Worker/client bundles for protected fixture and binding values.
- [ ] Make `temporary-surface-cleanup.test.ts` intentionally RED while temporary
  role-probe, restore, foundation, AI, and fault surfaces remain.
- [ ] Its future GREEN contract must delete temporary sources, tests, runtime
  schemas, workflow modes, one-minute routing, and generated references while
  retaining:
  - prepared-backup importer and offline restore tooling;
  - normal backup creation and `backups/v1/`;
  - permanent Worker/client scans;
  - permanent maintenance evidence and ordinary safe-tail framing;
  - measured database/R2 warnings;
  - observer/mutation separation and bounded timeouts;
  - the two normal crons;
  - backup key version 1;
  - historical plans, setbacks, credential history, and release evidence.
- [ ] Document that provider cleanup occurs only after reviewed source cleanup
  is deployed and verified.

Run:

```powershell
pnpm.cmd exec vitest run --project unit tests/security/google-write-surface.test.ts tests/security/secret-bundle.test.ts tests/security/temporary-surface-cleanup.test.ts
pnpm.cmd docs:check
pnpm.cmd security:scan
```

Expected: policy/bundle checks GREEN; the cleanup-residue test RED for the
explicit temporary files and no other reason.

### Step 3: Commit and independently review the candidate

- [ ] Verify zero migration diff and zero new secret inventory.
- [ ] Verify committed normal config is clean.
- [ ] Verify candidate config can only be generated from the reviewed source.
- [ ] Obtain independent workflow/security/cleanup review.
- [ ] Fix and re-review all Critical or Important findings.
- [ ] Commit:

```powershell
git add scripts tests .github wrangler.jsonc docs
git commit -m "test: enforce acceptance candidate cleanup boundary"
```

---

## Task 7: Complete Local Acceptance and Freeze the Candidate

### Step 1: Run the focused cross-slice suites

- [ ] Run:

```powershell
pnpm.cmd typecheck
pnpm.cmd test:unit
pnpm.cmd test:contract
pnpm.cmd test:worker
pnpm.cmd docs:check
pnpm.cmd build
pnpm.cmd security:scan
pnpm.cmd test:e2e
```

Expected GREEN: every command exits zero except the explicitly isolated
pre-cleanup residue assertion, which must be invoked only in its documented RED
mode until live acceptance finishes.

### Step 2: Run the complete gate

- [ ] Exclude no ordinary test.
- [ ] Keep the pre-cleanup residue test behind an exact temporary-candidate test
  mode so `pnpm check` remains truthful before cleanup and becomes strict GREEN
  after cleanup.
- [ ] Run:

```powershell
pnpm.cmd check
pnpm.cmd test:e2e
```

Expected GREEN: both commands exit zero.

### Step 3: Perform final static and privacy review

- [ ] Confirm:

```powershell
git diff --name-only -- migrations
git diff --check
pnpm.cmd docs:check
```

Expected: no migration paths, no whitespace errors, and documentation coverage
passes.

- [ ] Scan changed source, generated Worker bundle, generated client bundle,
  workflow artifacts, and evidence fixtures for protected values.
- [ ] Confirm no event-level Google write capability.
- [ ] Confirm backup key version remains 1 without reading the key.
- [ ] Confirm no code can delete `backups/v1/`.

### Step 4: Final whole-branch review and immutable handoff

- [ ] Give a fresh reviewer the approved specification, this plan, task commits,
  test evidence, and complete branch diff.
- [ ] Require zero Critical and zero Important findings.
- [ ] Fix and re-review until clean.
- [ ] Update `docs/operations/phase-b-evidence.md` with implementation status
  only; do not claim live acceptance yet.
- [ ] Commit any review/documentation correction:

```powershell
git add src tests scripts .github wrangler.jsonc docs
git commit -m "docs: prepare Phase B acceptance candidate"
```

- [ ] Push the exact reviewed candidate.
- [ ] Record its immutable commit for live acceptance.

## Live Execution After the Candidate Is Frozen

The implementation session continues in this exact order:

1. Give the user current Neon UI instructions to copy the disposable branch
   `vision_app` connection string to the clipboard; never request it in chat.
2. Run the already reviewed read-only role probe with observer active.
3. Immediately restore the immutable normal Worker.
4. Run the already reviewed fenced restore; restore normal; remove its two
   temporary Worker secrets; then delete only the opaque restore-attempt marker.
5. Ask the user to create one disposable event in the secondary Vision
   calendar; capture the foundation probe through the `queue_delayed` candidate;
   then ask the user to delete the event.
6. Run `job_failed`, `channel_expired`, `database_unavailable`,
   `r2_upload_failed`, and `ai_stopped` one candidate at a time, restoring and
   verifying normal after every terminal record.
7. Capture normal sync timing and missed-signal repair.
8. Give the user current Google UI instructions for wrong-account denial,
   permission revocation, disconnected-state verification, and reconnection.
9. Capture harmless AI and aggregate provider cost evidence.
10. Implement the surgical cleanup from the post-acceptance head.
11. Make `temporary-surface-cleanup.test.ts` GREEN, run the complete local gate,
    obtain independent review, push, deploy, and verify the clean normal Worker.
12. Delete temporary Worker secrets only after normal runtime is verified.
13. Give the user exact Neon UI instructions for permanent deletion of only the
    attested disposable branch, and require explicit confirmation at action time.
14. Complete the Phase B evidence map, mark Phase B complete only when every
    separate gate passes, and prepare the Phase C handoff.

## Plan Self-Review Checklist

- [ ] Every approved component has a production or temporary owner.
- [ ] All six scenarios appear exactly once in the strict enum and live matrix.
- [ ] One deployment produces one terminal record.
- [ ] Normal behavior is unchanged without the temporary binding and cron.
- [ ] No schema migration or new secret is required.
- [ ] Authentication and owner admission precede diagnostic overlays.
- [ ] R2 failure occurs before provider mutation.
- [ ] Foundation and AI evidence use exact closed schemas and bounded integers.
- [ ] Storage thresholds have one domain-policy source of truth.
- [ ] Current-state privacy evidence is not overstated.
- [ ] The Gateway verifier is read-only and same-workflow.
- [ ] Permanent and temporary surfaces are explicitly separated.
- [ ] Final cleanup is surgical and retains permanent recovery/evidence work.
- [ ] Backup key version 1 and `backups/v1/` are protected.
- [ ] Every implementation choice is concrete and fully specified.
