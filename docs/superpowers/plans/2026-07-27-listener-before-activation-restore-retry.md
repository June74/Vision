# Listener-Before-Activation Restore Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture one explicit successful preview restore record without an
observation gap, return preview to its normal runtime, remove the temporary
restore surface, and permanently delete only the attested disposable target.

**Architecture:** GitHub Actions assigns safe-tail observers and preview
mutations to separate conditional concurrency groups so the allowlisted
listener can be active before deployment. The retained disposable target is
handled by one temporary preview-only scheduled invocation. That invocation
validates the backup, atomically claims one opaque R2 attempt fence, clears only
the attested target in one serializable retained-session transaction, restores
the same prepared backup, and emits the existing allowlisted success record
only after independent read-back. Success is followed by normal rollback,
secret and marker removal, cleanup code, verification, and branch deletion;
every other result retains the branch.

**Tech Stack:** GitHub Actions, TypeScript, Vitest, Cloudflare Workers and
Wrangler, Neon PostgreSQL, R2, pnpm, PowerShell.

## Global Constraints

- Preview only; production data and production provider resources are never
  touched.
- `BACKUP_ENCRYPTION_KEY` remains unchanged at key version 1 and is never
  printed, requested, copied, or rotated.
- Only the exact provider-selected, database-attested disposable restore
  target may be emptied or deleted.
- Secret values, database identifiers, provider-private URLs, object keys,
  personal data, and protected rows never enter commands, logs, commits,
  documentation, screenshots, or chat.
- The disposable connection value exists only as a masked Cloudflare Worker
  secret. It never enters GitHub, commands, local files, logs, documentation,
  screenshots, or chat.
- Backup authentication, decryption, checksums, manifest counts, and references
  must validate before the one-shot fence is claimed or the target is opened.
- Exactly one invocation may own the opaque R2 create-if-absent fence. Every
  non-owner performs zero database calls and emits no observer-accepted record.
- The fence stays outside `backups/v1/`, its key is never returned, and it
  remains until the destructive runtime is inactive.
- The locked target must match all 29 prepared-backup table counts plus the safe
  51-row/13-non-empty/zero-event aggregate before deletion.
- Safe-tail must be actively running its
  `Print only allowlisted scheduled evidence` step before restore deployment.
- Safe-tail retains `--restore-only`, a 16-minute observation window, and an
  18-minute job timeout until the restore is captured.
- Only one exact-schema `vision.preview-restore/v1` record with
  `outcome=succeeded` is acceptable.
- Failure, missing evidence, malformed evidence, multiple evidence records, or
  ambiguity requires normal Worker restoration, temporary-secret deletion, and
  disposable-branch retention.
- Branch deletion occurs only after explicit success, normal Worker
  restoration, temporary-secret deletion, normal health/schedule verification,
  reviewed temporary-code cleanup, and final normal deployment.
- Every unexpected error, mistaken hypothesis, failed command, privacy concern,
  or unplanned delay is recorded in `docs/operations/setbacks/` before work
  continues.

## File Structure

- `.github/workflows/preview.yml` — conditional observer/mutation concurrency
  and the temporary bounded safe-tail command.
- `tests/unit/ci/workflows.test.ts` — structural contracts for concurrency,
  mutual exclusion, time bounds, secret absence, and observer command shape.
- `tests/unit/server/wrangler-routing.test.ts` — preview cron and deployed
  safe-tail command contracts.
- `docs/operations/restore-drill.md` — operator order, allowlisted evidence, and
  final restore result.
- `docs/operations/credential-change-log.md` — value-free create/delete records
  for only the two temporary restore secrets.
- `docs/operations/phase-b-evidence.md` — current automated and live restore
  acceptance evidence.
- `docs/operations/setbacks/INDEX.md` and exact incident files — tracked
  failures and recurrences.
- `src/jobs/temporary-preview-restore.ts` and
  `tests/integration/jobs/temporary-preview-restore.test.ts` — temporary
  one-shot clear-and-restore job and its test suite; deleted after success.
- `src/data/backup/temporary-preview-clear-adapter.ts` and its integration
  tests — temporary serializable clear boundary; deleted after success.
- `src/data/backup/import-backup.ts` — prepared-backup split so full validation
  completes before the R2 fence and the exact prepared object is restored.
- `src/data/backup/r2-restore-attempt-store.ts` — temporary atomic claim-only
  fence outside the backup namespace; deleted after success.
- `src/jobs/scheduled.ts`, `src/server/env.ts`, `wrangler.jsonc`, and
  `scripts/validate-preview-deploy-config.ts` — temporary runtime routing,
  bindings, and cron; restored to the normal two-cron surface after success.
- `scripts/print-safe-tail.ts`, `scripts/safe-tail-classifier.ts`, and their
  unit/reference files — temporary restore evidence selection; restore-only
  behavior removed after capture.
- `src/server/client-binding-boundary.ts`, `scripts/scan-release.ts`, and
  security fixtures/tests — temporary binding protection; reduced to the
  normal runtime after the bindings are removed.

---

### Task 1: Separate observer and preview-mutation concurrency

**Files:**
- Modify: `.github/workflows/preview.yml:26-28`
- Modify: `tests/unit/ci/workflows.test.ts:207-245`
- Modify: `docs/operations/restore-drill.md`

**Interfaces:**
- Consumes: existing workflow inputs `safe_tail` and `configure_ai_budget`.
- Produces: exact groups `vision-preview-observer` and
  `vision-preview-mutation`; observer and mutation runs may overlap, while two
  runs in the same group remain mutually exclusive.

- [ ] **Step 1: Add the failing workflow policy assertions**

Add these assertions to the existing
`preview live diagnostics policy` test:

```ts
expect(preview).toContain(
  "concurrency:\n" +
    "  group: ${{ inputs.safe_tail == true && inputs.configure_ai_budget == false && 'vision-preview-observer' || 'vision-preview-mutation' }}\n" +
    "  cancel-in-progress: true",
);
expect(preview).not.toContain("group: vision-preview\n");
expect(tailJob).toContain("timeout-minutes: 18");
expect(tailStep).toContain(
  "timeout 16m pnpm exec wrangler tail vision-preview --format json 2>/dev/null |\n" +
    "            pnpm exec tsx scripts/print-safe-tail.ts --restore-only",
);
```

Read `restore-drill.md` with the existing `readOperationsDocument` helper and
add:

```ts
expect(restoreDrill).toContain(
  "Confirm the allowlisted listener step is actively running before deploying the restore candidate.",
);
expect(restoreDrill).toContain(
  "Safe-tail observers use `vision-preview-observer`; deployment, verification, and Gateway configuration use `vision-preview-mutation`.",
);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
pnpm.cmd test:unit tests/unit/ci/workflows.test.ts
```

Expected: the diagnostics-policy test fails because the workflow still contains
the single `group: vision-preview` value and the restore drill lacks the two
required operator sentences.

- [ ] **Step 3: Implement the conditional concurrency group**

Replace the workflow concurrency block with:

```yaml
concurrency:
  group: ${{ inputs.safe_tail == true && inputs.configure_ai_budget == false && 'vision-preview-observer' || 'vision-preview-mutation' }}
  cancel-in-progress: true
```

Do not change job conditions. These existing conditions remain exact:

```yaml
if: ${{ inputs.safe_tail == false && inputs.configure_ai_budget == false }}
if: ${{ inputs.safe_tail == true && inputs.configure_ai_budget == false }}
if: ${{ inputs.configure_ai_budget == true && inputs.safe_tail == false }}
```

- [ ] **Step 4: Add the operator-order contract**

Add a `Listener-first retry` section to `restore-drill.md` containing these
sentences verbatim:

```markdown
Confirm the allowlisted listener step is actively running before deploying the restore candidate.

Safe-tail observers use `vision-preview-observer`; deployment, verification, and Gateway configuration use `vision-preview-mutation`.
```

Also state that same-category runs cancel one another, different categories may
overlap, and no deployment occurs if the observer never becomes active.

- [ ] **Step 5: Run focused and documentation checks**

Run:

```powershell
pnpm.cmd test:unit tests/unit/ci/workflows.test.ts
pnpm.cmd docs:check
git diff --check
```

Expected: all commands exit zero; the workflow test keeps the 16/18-minute
bounds, restore-only mode, mutation-job conditions, and secret absence.

- [ ] **Step 6: Commit and push the workflow gate**

Run:

```powershell
git add -- .github/workflows/preview.yml tests/unit/ci/workflows.test.ts docs/operations/restore-drill.md docs/operations/setbacks
git commit -m "ci separate restore observer from preview mutations"
git push origin codex/phase-b-foundation
```

Expected: the remote branch resolves to the new commit and the worktree is
clean.

- [ ] **Step 7: Independently review the exact Task 1 range**

Review from `e6240ce` through the Task 1 head. Require:

```text
Specification compliance: PASS
Code quality and safety: PASS
Critical findings: 0
Important findings: 0
```

Any finding is fixed test-first, rechecked, committed, pushed, and re-reviewed
before the target is touched.

---

### Task 2: Implement the fenced one-shot clear-and-restore candidate

**Files:**
- Create: `src/data/backup/temporary-preview-clear-adapter.ts`
- Create: `src/data/backup/r2-restore-attempt-store.ts`
- Create: `tests/integration/backup/temporary-preview-clear-adapter.test.ts`
- Create: `tests/integration/backup/r2-restore-attempt-store.test.ts`
- Modify: `src/data/backup/import-backup.ts`
- Modify: `src/jobs/temporary-preview-restore.ts`
- Modify: `src/jobs/scheduled.ts`
- Modify: `tests/integration/backup/restore-command.test.ts`
- Modify: `tests/integration/jobs/temporary-preview-restore.test.ts`
- Modify: `tests/integration/jobs/daily-backup.test.ts`
- Modify: `docs/operations/restore-drill.md`
- Modify generated simple and technical references for changed source files.

**Interfaces:**
- Consumes: the two existing temporary Worker secret bindings, the preview R2
  bucket, the exact prepared backup, and the database-owned disposable-target
  attestation.
- Produces: either no observer record for a non-owner, or one existing
  `vision.preview-restore/v1` success/failure record from the sole fence owner.
- No public HTTP route is added.

- [ ] **Step 1: Add failing prepared-backup boundary tests**

Refactor the importer contract test-first:

```ts
const prepared = await prepareBackupImport(encrypted, backupKey);
const report = await importPreparedBackup(prepared, target, options);
```

`prepareBackupImport` authenticates and decrypts the envelope, validates the
manifest/key version/checksum, decodes the canonical archive, requires all 29
manifest counts, and validates references. It returns an immutable prepared
object with no target capability. `importBackup` remains a compatibility wrapper
that calls both functions.

Tests require malformed/authentication/checksum/count/reference failures before
any target transaction call and prove that the prepared object used after the
fence is the same object passed to import.

- [ ] **Step 2: Add failing atomic R2 fence tests**

Define a narrow port:

```ts
export interface RestoreAttemptStore {
  claimOnce(targetId: string): Promise<boolean>;
}
```

The production R2 adapter derives an opaque SHA-256 key under
`restore-attempts/v1/` and uses conditional create-if-absent. Require two
concurrent claims to produce exactly one `true`; the loser performs no database
work. The key, target ID, object identity, and provider result never enter
evidence, errors, or logs. The prefix remains disjoint from `backups/v1/` and
backup retention/listing.

- [ ] **Step 3: Add failing serializable clear-adapter tests**

The adapter accepts the prepared backup row counts plus the exact target
identity. Tests require this order on one retained client:

```text
begin isolation level serializable
current_user=vision_app
one exact attestation row locked
all 29 authoritative tables locked in canonical order
attestation re-read unchanged
all 29 counts equal prepared manifest
safe aggregate equals 29/51/13/0
reverse-order deletes
all 29 counts equal zero
attestation re-read unchanged
commit
```

Any wrong role, attestation mismatch, table/count mismatch, nonzero event
count, lock/delete/postcondition/commit failure, or serialization error rolls
back. Client release and pool closure occur on every path. No target ID,
revision, database value, URL, row, or raw error appears in the returned closed
result.

- [ ] **Step 4: Implement the prepared importer, R2 fence, and clear adapter**

Use the repository-installed `@neondatabase/serverless` `Pool` with `max: 1`.
Reuse `BACKUP_TABLES`, `BACKUP_SCHEMA_MIGRATION_SHA256`, canonical quoted-table
construction, attestation validation, and dependency-safe reverse deletion.
Do not change database privileges or the attestation row.

- [ ] **Step 5: Convert the temporary restore job into one fenced invocation**

The exact order is:

```text
parse preview-only environment
select one newest validated backup object
verify stored encrypted object
prepare and fully validate backup
claim R2 fence
if non-owner: return null with no database/log action
clear exact target using prepared per-table counts
restore the same prepared backup into the empty target
independent snapshot/checksum/reference/event read-back
return existing exact vision.preview-restore/v1 evidence
```

Only the owner may return a closed failure. A marker-owner crash burns the
attempt; the one-minute job never retries automatically.

- [ ] **Step 6: Wire only the scheduled preview runtime**

`src/jobs/scheduled.ts` constructs the R2 attempt store, clear adapter, restore
target, and independent read-back from server-only bindings. When the job
returns `null`, it emits nothing and exits normally. When the owner returns
evidence, retain the exact existing:

```ts
console.info({ action: "backup.restore", evidence });
```

Do not add or modify HTTP routing. Preserve the existing one-minute preview cron
and normal production schedules.

- [ ] **Step 7: Run focused verification**

Run:

```powershell
pnpm.cmd test:unit tests/integration/backup/restore-command.test.ts tests/integration/backup/temporary-preview-clear-adapter.test.ts tests/integration/backup/r2-restore-attempt-store.test.ts tests/integration/jobs/temporary-preview-restore.test.ts tests/integration/jobs/daily-backup.test.ts
pnpm.cmd test:unit tests/unit/scripts/print-safe-tail.test.ts tests/unit/scripts/safe-tail-classifier.test.ts tests/unit/ci/workflows.test.ts tests/unit/server/wrangler-routing.test.ts
pnpm.cmd typecheck
pnpm.cmd docs:check
pnpm.cmd security:scan
git diff --check
```

Require all tests pass and a privacy scan proves private sentinels and marker
keys are absent from evidence and logs.

- [ ] **Step 8: Commit, push, and independently review**

Commit only the reviewed implementation, tests, documentation, and value-safe
setback records. Require independent specification and safety review with zero
Critical and zero Important findings. Any finding is fixed test-first and
re-reviewed before provider action.

---

### Task 3: Run the listener-first fenced restore and return to normal

**Files:**
- Modify after confirmed actions: `docs/operations/credential-change-log.md`
- Modify on success: `docs/operations/restore-drill.md`
- Modify on success: `docs/operations/phase-b-evidence.md`
- Modify on any setback: `docs/operations/setbacks/INDEX.md` and one exact
  incident.

**Interfaces:**
- Consumes: the exact reviewed Task 2 commit, two temporary Worker secrets,
  preview R2, the retained disposable target, and unchanged backup key version
  1.
- Produces: exactly one accepted `vision.preview-restore/v1` success, normal
  Worker restoration, absent temporary secrets/cron, and deletion of the sole
  opaque R2 fence without returning its key.

- [ ] **Step 1: Reconfirm the live candidate**

Require a clean worktree, equal local/remote commit, focused tests green, and
independent review accepted. Retain only the public commit SHA.

- [ ] **Step 2: Recreate only the two temporary secrets**

Through signed-in provider controls, recreate:

```text
PREVIEW_RESTORE_DATABASE_URL
PREVIEW_RESTORE_TARGET_ID
```

Use the already-approved direct provider-control flow. Never print, inspect,
save locally, place in GitHub, or put either value in command arguments. Verify
only their names and type `Secret`; add value-free `created` log rows.

- [ ] **Step 3: Start and prove the restore-only observer**

Dispatch the safe-tail workflow for the reviewed Task 2 commit with
`safe_tail=true` and `configure_ai_budget=false`. Continue only when
`Print only allowlisted scheduled evidence` is actively `in_progress`. Preserve
the 16-minute observation and 18-minute job limits.

- [ ] **Step 4: Deploy the exact one-shot candidate**

Only while the observer remains active, dispatch the preview mutation workflow
for the exact reviewed Task 2 commit. Prove observer/mutation overlap, exact
commit attribution, and successful verify/build/config/deploy jobs.

- [ ] **Step 5: Accept exactly one restore record**

Accept only one exact allowlisted object:

```text
evidenceType=vision.preview-restore/v1
outcome=succeeded
category=none
format=vision-backup/v1
schemaVersion=9
keyVersion=1
authoritativeTableCount=29
checksumMatches=true
referencesValid=true
targetWasEmpty=true
eventListReadable=true
replacedExisting=false
```

Require all 29 nonnegative row counts and a nonnegative event count. No result,
owner failure, malformed result, duplicate result, or ambiguity enters
fail-closed rollback with no automatic retry.

- [ ] **Step 6: Restore normal runtime and remove secrets**

Deploy immutable normal ref `40872a5`. Require successful exact attribution,
normal health schema, maintenance and daily backup crons present, temporary
one-minute cron absent, and then permanently delete only the two temporary
restore secrets. Confirm `BACKUP_ENCRYPTION_KEY` remains key version 1 and
unchanged.

- [ ] **Step 7: Delete only the opaque attempt marker**

After the destructive runtime is proven inactive and both temporary secrets are
absent, use the signed-in R2 control to select the
`restore-attempts/v1/` namespace. Require exactly one marker created by this
attempt, delete it without returning its key or object identity, and verify the
namespace is empty. Never delete any `backups/v1/` object.

- [ ] **Step 8: Record safe evidence**

Update the credential log, restore drill, Phase B evidence, and any setback
records using only safe booleans, counts, schema version, key version, and
public commit attribution.

---

### Superseded Task 2: Browser/editor clear path — do not execute

**Files:**
- Modify after confirmed provider actions:
  `docs/operations/credential-change-log.md`
- Modify only on a setback: `docs/operations/setbacks/INDEX.md`
- Create or modify a timestamped safe incident only on a setback:
  `docs/operations/setbacks/incidents/`

**Interfaces:**
- Consumes: the retained provider-selected disposable branch, its existing
  single-row `vision_restore_target_attestation`, and the reviewed migration-9
  checksum.
- Produces: an attested target with all 29 authoritative tables present and
  zero authoritative rows; no target identifier is returned.

- [ ] **Step 1: Verify the immutable local and remote candidate**

Run:

```powershell
git status --short --branch
git rev-parse HEAD
git rev-parse origin/codex/phase-b-foundation
pnpm.cmd test:unit tests/unit/ci/workflows.test.ts tests/unit/server/wrangler-routing.test.ts
```

Expected: clean worktree, equal local/remote commits, and focused tests pass.
Retain the exact commit in memory as `$candidateSha`; do not place any private
provider value in a shell variable.

- [ ] **Step 2: Acquire the exact target connection in memory only**

Use the signed-in Neon control and one temporary Node-backed browser/driver
session:

1. Select the already-retained disposable restore branch.
2. Select the `vision_app` role.
3. Confirm privately that this is not the normal preview branch.
4. Read the connection value directly from the signed-in browser surface into a
   process-local variable in that same temporary session.
5. Do not use the clipboard, filesystem, shell environment, command arguments,
   persistent tool storage, console, returned tool text, screenshots,
   documentation, or chat for the branch name, branch identifier, connection
   value, host, database name, or role credential.
6. Load the repository-installed `@neondatabase/serverless` package and create
   `new Pool({ connectionString, max: 1 })`. This is the same retained-session
   driver already used by `src/data/backup/neon-adapter.ts`.

Stop before SQL execution if any selector is ambiguous or any private value
would cross the in-memory-only boundary.

- [ ] **Step 3: Run the one-transaction fail-closed clear on one client**

Obtain one client with `await pool.connect()` and execute this exact SQL only on
that retained client and privately selected disposable branch. Do not run it in
the Neon web editor and do not split it across clients or requests:

```sql
begin isolation level serializable;

do $vision$
declare
  before_attestation public.vision_restore_target_attestation%rowtype;
  after_attestation public.vision_restore_target_attestation%rowtype;
  table_name text;
  row_count bigint;
  total_rows bigint := 0;
  nonempty_tables integer := 0;
  table_names constant text[] := array[
    'data_key_state',
    'wrapped_data_keys',
    'oauth_admission_windows',
    'oauth_transactions',
    'auth_sessions',
    'google_oauth_tokens',
    'calendar_setup_states',
    'calendar_setup_candidates',
    'vision_calendar_connections',
    'nodes',
    'events',
    'event_sync_payloads',
    'node_annotations',
    'node_category_assignments',
    'edges',
    'audit_events',
    'operation_ledger',
    'calendar_create_snapshots',
    'recoverable_deletions',
    'sync_checkpoints',
    'sync_channels',
    'calendar_sync_maintenance',
    'calendar_sync_jobs',
    'sync_runs',
    'projection_rebuild_generations',
    'projection_rebuild_changes',
    'ai_usage_months',
    'ai_usage_reservations',
    'ai_usage_ledger'
  ];
  delete_names constant text[] := array[
    'ai_usage_ledger',
    'ai_usage_reservations',
    'ai_usage_months',
    'projection_rebuild_changes',
    'projection_rebuild_generations',
    'sync_runs',
    'calendar_sync_jobs',
    'calendar_sync_maintenance',
    'sync_channels',
    'sync_checkpoints',
    'recoverable_deletions',
    'calendar_create_snapshots',
    'operation_ledger',
    'audit_events',
    'edges',
    'node_category_assignments',
    'node_annotations',
    'event_sync_payloads',
    'events',
    'nodes',
    'vision_calendar_connections',
    'calendar_setup_candidates',
    'calendar_setup_states',
    'google_oauth_tokens',
    'auth_sessions',
    'oauth_transactions',
    'oauth_admission_windows',
    'wrapped_data_keys',
    'data_key_state'
  ];
begin
  if current_user <> 'vision_app' then
    raise exception 'Unexpected restore role.';
  end if;

  select *
  into strict before_attestation
  from public.vision_restore_target_attestation;

  if before_attestation.environment <> 'preview'
     or before_attestation.disposable is not true
     or before_attestation.schema_version <> 9
     or before_attestation.migration_sha256 <>
       'd77c65c8f4d552b73505b471ac7f672f7651006b2a5190757dcf339e5e6d0e42'
     or before_attestation.target_id = ''
     or before_attestation.attestation_revision = '' then
    raise exception 'Restore target attestation is invalid.';
  end if;

  foreach table_name in array table_names loop
    execute format(
      'lock table public.%I in access exclusive mode',
      table_name
    );
  end loop;

  foreach table_name in array table_names loop
    execute format('select count(*) from public.%I', table_name)
      into row_count;
    total_rows := total_rows + row_count;
    if row_count > 0 then
      nonempty_tables := nonempty_tables + 1;
    end if;
  end loop;

  if total_rows <> 51 or nonempty_tables <> 13 then
    raise exception 'Restore target aggregate changed before clear.';
  end if;

  select count(*) into row_count from public.events;
  if row_count <> 0 then
    raise exception 'Restore target event count changed before clear.';
  end if;

  foreach table_name in array delete_names loop
    execute format('delete from public.%I', table_name);
  end loop;

  total_rows := 0;
  nonempty_tables := 0;
  foreach table_name in array table_names loop
    execute format('select count(*) from public.%I', table_name)
      into row_count;
    total_rows := total_rows + row_count;
    if row_count > 0 then
      nonempty_tables := nonempty_tables + 1;
    end if;
  end loop;

  if total_rows <> 0 or nonempty_tables <> 0 then
    raise exception 'Restore target clear verification failed.';
  end if;

  select *
  into strict after_attestation
  from public.vision_restore_target_attestation;

  if after_attestation is distinct from before_attestation then
    raise exception 'Restore target attestation changed.';
  end if;

  raise notice
    'attestation_ok=true authoritative_table_count=29 total_rows=0 nonempty_tables=0 event_rows=0';
end
$vision$;

commit;
```

Expected: the driver call completes successfully. Treat the safe notice as
diagnostic only; do not forward raw driver notices. Any error rolls back the
entire clear. Release the client, close the pool, remove live connection
references, reset the temporary Node process, and do not retry until the error
is logged and diagnosed.

- [ ] **Step 4: Recheck without mutation, then destroy the session**

Using a newly obtained client from the same still-private pool, run a separate
read-only aggregate check against the same provider-selected branch. Accept
only:

```text
attestation_ok=true
authoritative_table_count=29
total_rows=0
nonempty_tables=0
event_rows=0
```

The check must not return table rows, target identity, connection information,
or attestation values.

In a `finally` path, release every client, close the pool, set every live
connection-value reference to `undefined`, and reset the temporary Node kernel.
JavaScript strings cannot be guaranteed to be physically zeroized; no
persistence, no output, shortest practical lifetime, and kernel reset are the
required controls.

---

### Superseded Task 3: Separate clear/deploy path — do not execute

**Files:**
- Modify: `docs/operations/credential-change-log.md`
- Modify on success: `docs/operations/restore-drill.md`
- Modify on success: `docs/operations/phase-b-evidence.md`
- Modify on any setback: `docs/operations/setbacks/INDEX.md`
- Create or modify a timestamped safe incident on any setback:
  `docs/operations/setbacks/incidents/`

**Interfaces:**
- Consumes: the reviewed `$candidateSha`, empty attested target, existing
  preview backup, and unchanged key version 1.
- Produces: exactly one closed successful `vision.preview-restore/v1` record,
  followed by normal Worker restoration and verified absence of both temporary
  secrets.

- [ ] **Step 1: Recreate only the two temporary Worker secrets**

Through signed-in provider controls, set:

```text
PREVIEW_RESTORE_DATABASE_URL
PREVIEW_RESTORE_TARGET_ID
```

Use the disposable target values directly in private provider controls. Do not
print, inspect, paste into chat, save to disk, put in GitHub, or put in command
arguments. Verify only that both names exist with type `Secret`. Add two
value-free `created` rows to `credential-change-log.md`.

- [ ] **Step 2: Dispatch the observer first**

Run:

```powershell
$candidateSha = git rev-parse HEAD
$observerDispatchedAt = [DateTime]::UtcNow
gh workflow run preview.yml --ref codex/phase-b-foundation -f "ref=$candidateSha" -f "safe_tail=true" -f "configure_ai_budget=false"
```

Resolve the new run by workflow, branch, event, head commit, and
`createdAt >= $observerDispatchedAt`. Retain only its numeric run identifier,
status, conclusion, and commit.

- [ ] **Step 3: Prove the listener step is active**

Poll `gh run view $observerRunId --json jobs` every five seconds, with a
five-minute local bound. Continue only when the job named
`Capture one safe scheduled outcome` contains:

```text
step.name=Print only allowlisted scheduled evidence
step.status=in_progress
run.status=in_progress
```

If the step completes, fails, or does not become active within five minutes,
do not deploy. Delete the two temporary secrets, record value-free `deleted`
rows, retain the branch, and log the setback.

- [ ] **Step 4: Dispatch the exact restore candidate**

Only while the listener remains active, run:

```powershell
$deployDispatchedAt = [DateTime]::UtcNow
gh workflow run preview.yml --ref codex/phase-b-foundation -f "ref=$candidateSha" -f "safe_tail=false" -f "configure_ai_budget=false"
```

Resolve the new mutation run by workflow, branch, event, commit, and dispatch
time. While it is queued or running, re-read the observer and record only:

```text
observer_active_during_deploy=true
observer_conclusion=success
deployment_conclusion=success
deployed_commit_matches=true
```

If the observer is canceled by the deploy, treat the concurrency change as
failed and execute fail-closed cleanup.

- [ ] **Step 5: Validate exactly one allowlisted result**

Read only the already-sanitized output of the
`Print only allowlisted scheduled evidence` step. Accept one and only one JSON
object with these exact facts:

```text
evidenceType=vision.preview-restore/v1
outcome=succeeded
category=none
format=vision-backup/v1
schemaVersion=9
keyVersion=1
authoritativeTableCount=29
checksumMatches=true
referencesValid=true
targetWasEmpty=true
eventListReadable=true
replacedExisting=false
```

Require a complete 29-key nonnegative `rowCounts` object and a nonnegative safe
integer `eventCount`. Do not accept or record any extra key. Missing, duplicate,
failed, malformed, or ambiguous output enters fail-closed cleanup.

- [ ] **Step 6: Restore the normal Worker immediately**

Dispatch the normal immutable ref:

```powershell
$normalSha = "40872a5"
gh workflow run preview.yml --ref codex/phase-b-foundation -f "ref=$normalSha" -f "safe_tail=false" -f "configure_ai_budget=false"
```

Require successful verify, browser smoke, build, generated-configuration
validation, and deploy jobs. Verify exact deployment attribution to
`40872a5`.

- [ ] **Step 7: Delete and verify both temporary secrets**

Delete only:

```text
PREVIEW_RESTORE_DATABASE_URL
PREVIEW_RESTORE_TARGET_ID
```

Verify absence by name. Do not modify `BACKUP_ENCRYPTION_KEY`,
`BACKUP_KEY_VERSION`, `KEY_ENCRYPTION_KEY`, Google credentials, deployment
credentials, Gateway configuration, or AI credentials. Add value-free
`deleted` rows to `credential-change-log.md`.

- [ ] **Step 8: Verify normal runtime containment**

Require:

```text
health_http_status=200
health_exact_schema=true
maintenance_cron_present=true
daily_backup_cron_present=true
temporary_restore_cron_absent=true
temporary_restore_database_secret_absent=true
temporary_restore_target_secret_absent=true
backup_key_version=1
backup_key_changed=false
```

On any failed or uncertain field, retain the disposable branch and continue
containment. Do not begin branch deletion.

---

### Task 4: Remove the temporary runtime and deploy the reviewed cleanup

**Files:**
- Delete: `src/data/backup/temporary-preview-clear-adapter.ts`
- Delete: `src/data/backup/r2-restore-attempt-store.ts`
- Delete: `tests/integration/backup/temporary-preview-clear-adapter.test.ts`
- Delete: `tests/integration/backup/r2-restore-attempt-store.test.ts`
- Delete: `src/jobs/temporary-preview-restore.ts`
- Delete: `tests/integration/jobs/temporary-preview-restore.test.ts`
- Delete: `docs/reference/simple/src/jobs/temporary-preview-restore.md`
- Delete: `docs/reference/technical/src/jobs/temporary-preview-restore.md`
- Modify: `.github/workflows/preview.yml`
- Modify: `src/jobs/scheduled.ts`
- Modify: `src/server/env.ts`
- Modify: `src/jobs/purge-expired-backups.ts`
- Modify: `scripts/print-safe-tail.ts`
- Modify: `scripts/safe-tail-classifier.ts`
- Modify: `scripts/validate-preview-deploy-config.ts`
- Modify: `wrangler.jsonc`
- Modify: `src/server/client-binding-boundary.ts`
- Modify: `scripts/scan-release.ts`
- Modify: `tests/integration/jobs/daily-backup.test.ts`
- Modify: `tests/integration/jobs/backup-retention.test.ts`
- Modify: `tests/unit/server/env.test.ts`
- Modify: `tests/unit/server/wrangler-routing.test.ts`
- Modify: `tests/unit/scripts/print-safe-tail.test.ts`
- Modify: `tests/unit/scripts/safe-tail-classifier.test.ts`
- Modify: `tests/unit/ci/workflows.test.ts`
- Modify: `tests/security/secret-bundle.test.ts`
- Modify: `tests/security/release-test-fixture.ts`
- Modify: `docs/reference/simple/src/jobs/_folder.md`
- Modify: `docs/reference/technical/src/jobs/_folder.md`
- Modify: `docs/reference/simple/src/jobs/scheduled.md`
- Modify: `docs/reference/technical/src/jobs/scheduled.md`
- Modify: `docs/reference/simple/src/jobs/purge-expired-backups.md`
- Modify: `docs/reference/technical/src/jobs/purge-expired-backups.md`
- Modify: `docs/reference/simple/scripts/print-safe-tail.md`
- Modify: `docs/reference/technical/scripts/print-safe-tail.md`
- Modify: `docs/reference/simple/scripts/safe-tail-classifier.md`
- Modify: `docs/reference/technical/scripts/safe-tail-classifier.md`
- Modify: `docs/reference/simple/scripts/scan-release.md`
- Modify: `docs/reference/technical/scripts/scan-release.md`
- Modify: `docs/reference/simple/src/server/client-binding-boundary.md`
- Modify: `docs/reference/technical/src/server/client-binding-boundary.md`
- Modify: `docs/operations/secrets.md`
- Modify: `docs/operations/restore-drill.md`
- Modify: `docs/operations/phase-b-evidence.md`
- Modify: `docs/operations/credential-change-log.md`

**Interfaces:**
- Consumes: successful Task 3 evidence and verified normal runtime.
- Produces: a reviewed normal runtime with only maintenance and daily backup
  schedules, no Worker restore bindings/job, and retained permanent operator
  restore tooling.

- [ ] **Step 1: Change cleanup tests to the normal contracts**

Update the focused tests before production code. The expected scheduler
interface becomes:

```ts
export interface ScheduledJobDependencies {
  readonly maintenance: (now: Date) => Promise<void>;
  readonly recovery: (now: Date) => Promise<void>;
}
```

The expected preview crons become:

```ts
expect(config.env?.preview.triggers?.crons).toEqual([
  "*/15 * * * *",
  "5 6 * * *",
]);
```

The expected safe-tail workflow command becomes:

```ts
expect(tailStep).toContain(
  "timeout 16m pnpm exec wrangler tail vision-preview --format json 2>/dev/null |\n" +
    "            pnpm exec tsx scripts/print-safe-tail.ts",
);
expect(tailStep).not.toContain("--restore-only");
```

Remove restore-evidence test imports, fixtures, categories, and argument-mode
cases. Keep tests for incremental JSON framing, recovery classification,
closed fallback output, argument rejection, 16/18-minute bounds, conditional
concurrency, and raw-log non-persistence.

- [ ] **Step 2: Run the focused cleanup tests and confirm RED**

Run:

```powershell
pnpm.cmd test:unit tests/unit/server/env.test.ts tests/unit/server/wrangler-routing.test.ts tests/unit/scripts/print-safe-tail.test.ts tests/unit/scripts/safe-tail-classifier.test.ts tests/unit/ci/workflows.test.ts
pnpm.cmd test:unit tests/integration/jobs/daily-backup.test.ts
```

Expected: failures show the temporary third cron, restore dependency, runtime
schema, restore-only argument, and restore classifier are still present.

- [ ] **Step 3: Remove the temporary scheduled job and bindings**

Delete the temporary clear adapter, R2 attempt store, temporary job module, and
their integration/reference files. Preserve the permanent prepared-backup
importer API and its tests. Restore the scheduler to:

```ts
export interface ScheduledJobDependencies {
  readonly maintenance: (now: Date) => Promise<void>;
  readonly recovery: (now: Date) => Promise<void>;
}

export async function runScheduledJob(
  cron: string,
  now: Date,
  dependencies: ScheduledJobDependencies,
): Promise<void> {
  if (cron === CALENDAR_MAINTENANCE_CRON) {
    await dependencies.maintenance(now);
    return;
  }
  if (cron === DAILY_BACKUP_CRON) {
    await dependencies.recovery(now);
    return;
  }
  throw new Error("Scheduled cron is unsupported.");
}
```

Remove `TemporaryRestoreEnvSchema`,
`PREVIEW_RESTORE_DATABASE_URL`, and `PREVIEW_RESTORE_TARGET_ID` from the Worker
runtime schema. Do not remove the permanent operator-shell parsing in
`scripts/restore-backup.ts` or its integration tests.

- [ ] **Step 4: Restore normal configuration and tail behavior**

Set preview crons to:

```json
["*/15 * * * *", "5 6 * * *"]
```

Update `validatePreviewDeployConfig` to require exactly those two crons.
Retain Task 1's conditional concurrency block. Remove `--restore-only` from the
workflow command and remove restore-specific types/functions from
`safe-tail-classifier.ts`.

The resulting `print-safe-tail.ts` accepts no arguments:

```ts
if (process.argv.length !== 2) {
  process.exit(1);
}
```

It emits the first ordinary allowlisted recovery result or the existing closed
`no_scheduled_event` fallback.

- [ ] **Step 5: Remove temporary security and documentation surfaces**

Remove the two temporary Worker binding names from
`RUNTIME_CLIENT_FORBIDDEN_BINDING_NAMES`, restore-specific classifier
documentation, restore-only CLI documentation, temporary secret inventory
rows, and temporary job folder entries. Preserve:

```text
scripts/restore-backup.ts
tests/integration/backup/restore-command.test.ts
docs/operations/backup-and-restore.md
docs/reference/simple/scripts/restore-backup.md
docs/reference/technical/scripts/restore-backup.md
```

Those are the permanent offline restore path, not the temporary Worker path.
Also verify the `restore-attempts/v1/` R2 namespace is empty without returning
any object key; do not inspect or delete `backups/v1/`.

- [ ] **Step 6: Run the complete cleanup verification**

Run sequentially:

```powershell
pnpm.cmd typecheck
pnpm.cmd test:unit
pnpm.cmd test:contract
pnpm.cmd test:worker
pnpm.cmd test:e2e
pnpm.cmd docs:check
pnpm.cmd build
pnpm.cmd security:scan
git diff --check
```

Expected: every command exits zero; no temporary Worker restore module, cron,
runtime binding, or restore-only tail mode remains; permanent encrypted backup
and operator restore support still passes.

- [ ] **Step 7: Commit, push, and independently review cleanup**

Run:

```powershell
git add -- .github/workflows/preview.yml src scripts tests wrangler.jsonc docs
git commit -m "chore remove temporary preview restore runtime"
git push origin codex/phase-b-foundation
```

Review from the Task 3 candidate head through cleanup head. Require PASS/PASS,
zero Critical findings, zero Important findings, and explicit confirmation that
the permanent offline restore command remains.

- [ ] **Step 8: Deploy and verify the exact cleanup commit**

Dispatch the guarded preview deployment with the full cleanup commit. Require
all verification/deploy jobs to pass and exact commit attribution. Verify:

```text
health_http_status=200
health_exact_schema=true
maintenance_cron_present=true
daily_backup_cron_present=true
temporary_restore_cron_absent=true
temporary_restore_secrets_absent=true
backup_key_version=1
backup_key_changed=false
```

---

### Task 5: Delete the disposable branch and close restore evidence

**Files:**
- Modify: `docs/operations/restore-drill.md`
- Modify: `docs/operations/phase-b-evidence.md`
- Modify: `docs/operations/credential-change-log.md`
- Modify: `docs/operations/setbacks/INDEX.md`
- Modify: `docs/operations/setbacks/incidents/2026-07-27T200141Z-restore-target-not-empty.md`
- Modify: `docs/operations/phase-b-progress-simple.md`
- Modify: `docs/operations/phase-b-progress-technical.md`

**Interfaces:**
- Consumes: explicit success evidence, deployed reviewed cleanup, normal health
  and schedules, absent temporary secrets, and unchanged backup key.
- Produces: verified branch deletion and a closed restore gate. Remaining Phase
  B gates continue from `phase-b-evidence.md`; this task does not falsely mark
  the whole phase complete.

- [ ] **Step 1: Reconfirm all deletion preconditions**

Require every field:

```text
explicit_restore_success=true
normal_worker_restored=true
cleanup_commit_deployed=true
normal_health_verified=true
normal_schedules_verified=true
temporary_secrets_absent=true
backup_key_changed=false
target_is_disposable=true
target_is_not_preview_primary=true
```

Any false or unknown field blocks deletion and retains the branch.

- [ ] **Step 2: Permanently delete only the attested disposable branch**

In the signed-in Neon control, resolve the same retained branch without
recording its identifier. Reconfirm it is disposable and is not the normal
preview primary branch. Permanently delete only that branch and verify that the
branch count decreases by one and the retained target is absent.

- [ ] **Step 3: Close the restore evidence**

Update `restore-drill.md` to mark every drill item passed and record only:

```text
success record captured=true
schema version=9
authoritative tables=29
checksums matched=true
references valid=true
target was empty=true
event list readable=true
replaced existing=false
normal Worker restored=true
temporary secrets absent=true
disposable branch deleted=true
backup key version=1
backup key changed=false
```

Update `phase-b-evidence.md` to mark only the encrypted-backup-restore gate
Pass. Keep every unrelated live gate at its evidence-based current state.

- [ ] **Step 4: Validate and commit the restore closure**

Run:

```powershell
pnpm.cmd docs:check
pnpm.cmd security:scan
git diff --check
git add -- docs/operations
git commit -m "docs complete preview restore acceptance"
git push origin codex/phase-b-foundation
```

Expected: all checks pass and no private provider value appears in the diff.

- [ ] **Step 5: Resume the remaining Phase B completion gates**

Use the current `phase-b-evidence.md` gate map as the source of truth. The next
work begins with a fresh brainstorming/specification cycle for the remaining
live instrumentation gaps: Google wrong-account and revoked-access acceptance,
near-real-time synchronization and missed-notification repair, live aggregate
privacy/provenance checks, failure-state exercises, and the live AI cost path.
Do not declare Phase B complete until each row has current automated and live
evidence and the final reviewed preview deployment is attributable.

## Superseded post-acceptance cleanup order

Post-acceptance provider cleanup is governed by Task 10 of the approved
2026-07-29 live-acceptance closure plan. Do not execute this document's older
marker-first sequence. The controlling order is reviewed Task 9 cleanup
deployment, normal-state proof, disposable-branch deletion and absence proof,
then replay-marker deletion last. If branch deletion or absence is uncertain,
retain the marker and stop. Provider deletion remains manual; no workflow
receives a deletion operation. Backup key version 1 remains unchanged.
