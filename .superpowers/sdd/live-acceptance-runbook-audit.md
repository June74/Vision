# Live acceptance runbook audit

Status: read-only audit of checked-in sources. No workflow was dispatched, no
provider was contacted, and no tracked file was changed.

This is a controller aid, not authorization to execute. It uses placeholders
only. Never replace a placeholder in a saved command, document, chat message,
screenshot, or shell history with a credential, private connection value,
provider identifier, object key, event content, or provider response text.

## Classification

- `[RO]` reads or observes. Dispatching an observer creates a workflow run but
  does not deploy, configure, write application data, or exercise a provider
  write boundary.
- `[M]` is a reversible mutation: deploy, rollback deploy, authorization
  change, harmless AI request, or disposable test-data creation.
- `[D]` is destructive: deleting a secret, event, opaque marker, or disposable
  database branch. Every `[D]` step requires an immediate explicit confirmation.

## Placeholders

Use these only in controller memory:

- `<FROZEN_ACCEPTANCE_DISPATCH_REF>`: the frozen branch or tag whose dispatch
  commit is the reviewed acceptance commit.
- `<IMMUTABLE_ROLE_PROBE_WORKFLOW_REF>` and `<IMMUTABLE_ROLE_PROBE_COMMIT>`:
  the reviewed legacy role-probe workflow ref and exact candidate commit.
- `<IMMUTABLE_RESTORE_WORKFLOW_REF>` and `<IMMUTABLE_RESTORE_COMMIT>`:
  the reviewed legacy fenced-restore workflow ref and exact candidate commit.
- `<IMMUTABLE_NORMAL_COMMIT>`: the reviewed normal Worker commit used by the
  legacy workflows.
- `<ACTIVE_OBSERVER_RUN_ID>`: retained in controller memory only; never copied
  into evidence.
- `<EVIDENCE_FAMILY>`: one of the exact current observer choices below.
- `<FAULT_SCENARIO>`: one of the exact six fault choices below.
- `<TEMP_DATABASE_SECRET_NAME>`, `<TEMP_TARGET_SECRET_NAME>`,
  `<PROTECTED_BACKUP_KEY_NAME>`: provider-control labels resolved privately.

## Gate 0: frozen candidate and local preflight

Classification: `[RO]`.

Run from the acceptance worktree:

```powershell
git status --short --branch
git rev-parse HEAD
git rev-parse "<FROZEN_ACCEPTANCE_DISPATCH_REF>"
pnpm.cmd check
pnpm.cmd test:e2e
pnpm.cmd build
pnpm.cmd deploy:check:preview
pnpm.cmd docs:check
pnpm.cmd security:scan
```

Continue only when the worktree is clean, the intended frozen ref resolves to
the independently reviewed commit, every command passes, the complete diff has
zero Critical and zero Important findings, and the reviewed normal artifact has
exactly the permanent maintenance and daily-recovery schedules with no
acceptance binding.

Before every candidate, authenticated diagnostics and calendar reads must be
performed in the signed-in application and privately attested as successful.
That human proof is what authorizes
`authenticated_reads_gate=verified`. Do not set it from test output alone.

## Current workflow contract

Workflow: `preview.yml`.

Exact inputs:

- `acceptance_operation`: `none`, `observe`, `deploy_foundation`, `deploy_ai`,
  `deploy_fault`, or `rollback`.
- `fault_scenario`: `none`, `queue_delayed`, `job_failed`, `channel_expired`,
  `database_unavailable`, `r2_upload_failed`, or `ai_stopped`.
- `authenticated_reads_gate`: `not_verified` or `verified`.
- `observer_evidence`: `calendar_maintenance`, `foundation_probe`, `ai_usage`,
  or `preview_fault`.
- `observer_run_id`: empty except for a candidate deployment.
- `configure_ai_budget`: `false` for acceptance observation, candidate
  deployment, rollback, and normal deployment.

The operation combinations are closed:

| Purpose | operation | fault | reads gate | observer evidence |
|---|---|---|---|---|
| Normal maintenance observer | `observe` | `none` | `not_verified` | `calendar_maintenance` |
| Foundation observer | `observe` | `none` | `not_verified` | `foundation_probe` |
| Foundation candidate | `deploy_foundation` | `none` | `verified` | `foundation_probe` |
| AI observer | `observe` | `none` | `not_verified` | `ai_usage` |
| AI candidate | `deploy_ai` | `none` | `verified` | `ai_usage` |
| Fault observer | `observe` | `none` | `not_verified` | `preview_fault` |
| One fault candidate | `deploy_fault` | one exact fault | `verified` | `preview_fault` |
| Normal rollback | `rollback` | `none` | `verified` | `calendar_maintenance` |

### Current observer command

Classification: `[RO]`.

```powershell
gh workflow run preview.yml --ref "<FROZEN_ACCEPTANCE_DISPATCH_REF>" `
  -f "acceptance_operation=observe" `
  -f "fault_scenario=none" `
  -f "authenticated_reads_gate=not_verified" `
  -f "observer_evidence=<EVIDENCE_FAMILY>" `
  -f "observer_run_id=" `
  -f "configure_ai_budget=false"
```

Resolve the newly dispatched run without recording its identifier. Inspect it
every five seconds for at most five minutes:

```powershell
gh run view "<ACTIVE_OBSERVER_RUN_ID>" --json status,conclusion,headSha,jobs
```

The exact proof is:

- run status is `in_progress`, conclusion is absent, and dispatch commit equals
  the frozen acceptance commit;
- exactly one job named
  `Capture <EVIDENCE_FAMILY> safe scheduled outcome` is `in_progress`;
- exactly one step named `Print only allowlisted acceptance evidence` is
  `in_progress`;
- the observer has a 16-minute tail bound and an 18-minute job bound.

If it is not active within five minutes, ends, fails, or is cancelled, do not
deploy. A candidate workflow repeats the workflow identity, commit, evidence
family, run state, job state, and listener-step proof twice: once before
candidate preparation and again immediately before deployment.

### Current candidate commands

Foundation `[M]`:

```powershell
gh workflow run preview.yml --ref "<FROZEN_ACCEPTANCE_DISPATCH_REF>" `
  -f "acceptance_operation=deploy_foundation" `
  -f "fault_scenario=none" `
  -f "authenticated_reads_gate=verified" `
  -f "observer_evidence=foundation_probe" `
  -f "observer_run_id=<ACTIVE_OBSERVER_RUN_ID>" `
  -f "configure_ai_budget=false"
```

AI `[M]`:

```powershell
gh workflow run preview.yml --ref "<FROZEN_ACCEPTANCE_DISPATCH_REF>" `
  -f "acceptance_operation=deploy_ai" `
  -f "fault_scenario=none" `
  -f "authenticated_reads_gate=verified" `
  -f "observer_evidence=ai_usage" `
  -f "observer_run_id=<ACTIVE_OBSERVER_RUN_ID>" `
  -f "configure_ai_budget=false"
```

One fault `[M]`:

```powershell
gh workflow run preview.yml --ref "<FROZEN_ACCEPTANCE_DISPATCH_REF>" `
  -f "acceptance_operation=deploy_fault" `
  -f "fault_scenario=<FAULT_SCENARIO>" `
  -f "authenticated_reads_gate=verified" `
  -f "observer_evidence=preview_fault" `
  -f "observer_run_id=<ACTIVE_OBSERVER_RUN_ID>" `
  -f "configure_ai_budget=false"
```

Run fault candidates in this exact order:

1. `queue_delayed`
2. `job_failed`
3. `channel_expired`
4. `database_unavailable`
5. `r2_upload_failed`
6. `ai_stopped`

Never reuse an observer run. Start a fresh matching observer for every
foundation, AI, or fault candidate.

### Current rollback command

Classification: `[M]`. Dispatch immediately after one terminal record, after
any candidate failure, or whenever candidate deployment status is uncertain.

```powershell
gh workflow run preview.yml --ref "<FROZEN_ACCEPTANCE_DISPATCH_REF>" `
  -f "acceptance_operation=rollback" `
  -f "fault_scenario=none" `
  -f "authenticated_reads_gate=verified" `
  -f "observer_evidence=calendar_maintenance" `
  -f "observer_run_id=" `
  -f "configure_ai_budget=false"
```

Rollback proof must include:

- the rollback dispatch commit is the reviewed frozen acceptance commit;
- immutable normal artifact build and preview validation pass;
- normal deployment succeeds;
- unauthenticated health is successful and exact-shape;
- authenticated diagnostics and calendar reads succeed;
- exactly the two permanent schedules are present;
- the acceptance schedule and acceptance binding are absent.

No next candidate, user cleanup, secret deletion, marker deletion, or database
branch deletion is permitted before all rollback proof is true.

### Conditional Gateway configuration

`configure_ai_budget=true` is a separate `[M]` operation, not part of an
ordinary acceptance candidate. Use it only if an explicit approval and a
reviewed need exist. The AI candidate itself uses the read-only
`pnpm.cmd gateway:verify:preview` check in the same workflow run.

```powershell
gh workflow run preview.yml --ref "<FROZEN_ACCEPTANCE_DISPATCH_REF>" `
  -f "acceptance_operation=none" `
  -f "fault_scenario=none" `
  -f "authenticated_reads_gate=not_verified" `
  -f "observer_evidence=calendar_maintenance" `
  -f "observer_run_id=" `
  -f "configure_ai_budget=true"
```

## Daily-recovery exclusion

Temporary candidate activation is blocked from 05:35 UTC inclusive through
06:35 UTC exclusive. Therefore 06:05 UTC is explicitly excluded.

The candidate workflow checks this window before preparation and again
immediately before deployment. Do not override or retry around a failure.
Prefer not to start the matching 16-minute observer when there is insufficient
time to deploy and capture before 05:35 UTC. Observing the normal maintenance
schedule is non-mutating, but no temporary candidate may activate in the
blocked window.

## Legacy immutable role-probe sequence

The role-probe workflow has the older exact inputs `ref`, `safe_tail`, and
`configure_ai_budget`. It is not the current acceptance workflow contract.

1. `[M]` Immediately before the observer, the user selects the already-retained
   disposable database branch and least-privileged application role in the
   signed-in database UI, confirms privately that it is not the normal preview
   branch, copies the connection value to the clipboard, and pastes it directly
   into the hosting provider's secret-value control for
   `<TEMP_DATABASE_SECRET_NAME>`. The value must never enter chat, a command,
   shell variable, file, screenshot, console, or evidence. Verify only that the
   secret name exists and its type is secret.
2. `[RO]` Start the role-only observer:

```powershell
gh workflow run preview.yml --ref "<IMMUTABLE_ROLE_PROBE_WORKFLOW_REF>" `
  -f "ref=<IMMUTABLE_ROLE_PROBE_COMMIT>" `
  -f "safe_tail=true" `
  -f "configure_ai_budget=false"
```

3. `[RO]` Poll every five seconds, at most five minutes. Continue only when job
   `Capture one safe scheduled outcome` and step
   `Print only allowlisted scheduled evidence` are both `in_progress`; retain
   the 16-minute tail and 18-minute job limits.
4. `[M]` While that listener is active, deploy the exact candidate:

```powershell
gh workflow run preview.yml --ref "<IMMUTABLE_ROLE_PROBE_WORKFLOW_REF>" `
  -f "ref=<IMMUTABLE_ROLE_PROBE_COMMIT>" `
  -f "safe_tail=false" `
  -f "configure_ai_budget=false"
```

5. `[RO]` Accept exactly one role-probe record: `outcome=succeeded`,
   `category=none`, and `roleMatches=true`. Missing, failed, malformed,
   duplicated, mixed, or misattributed evidence fails closed.
6. `[M]` Immediately deploy immutable normal through the same reviewed legacy
   workflow:

```powershell
gh workflow run preview.yml --ref "<IMMUTABLE_ROLE_PROBE_WORKFLOW_REF>" `
  -f "ref=<IMMUTABLE_NORMAL_COMMIT>" `
  -f "safe_tail=false" `
  -f "configure_ai_budget=false"
```

7. `[RO]` Prove normal health, the two permanent schedules, and absence of the
   temporary schedule. If the role result was not accepted, `[D]` explicitly
   confirm deletion of only `<TEMP_DATABASE_SECRET_NAME>`, verify absence, and
   stop. If accepted, retain it only for the fenced restore.

## Legacy immutable fenced-restore sequence

The fenced restore uses the same older three-input workflow contract.

1. `[M]` After role success and normal proof, create only
   `<TEMP_TARGET_SECRET_NAME>` through signed-in provider controls. Verify only
   the two temporary secret names and their secret type.
2. `[RO]` Start the restore-only observer:

```powershell
gh workflow run preview.yml --ref "<IMMUTABLE_RESTORE_WORKFLOW_REF>" `
  -f "ref=<IMMUTABLE_RESTORE_COMMIT>" `
  -f "safe_tail=true" `
  -f "configure_ai_budget=false"
```

3. `[RO]` Poll every five seconds, at most five minutes, for the same legacy job
   and step names to be `in_progress`.
4. `[M]` While the observer is active, deploy exactly one fenced candidate:

```powershell
gh workflow run preview.yml --ref "<IMMUTABLE_RESTORE_WORKFLOW_REF>" `
  -f "ref=<IMMUTABLE_RESTORE_COMMIT>" `
  -f "safe_tail=false" `
  -f "configure_ai_budget=false"
```

5. `[RO]` Accept exactly one restore record with success/none, the approved
   backup format and schema/key versions, the approved authoritative-table
   count, checksum/reference/readability booleans true, target-empty true,
   replacement false, all per-table counts nonnegative, and a nonnegative event
   count. Record counts and booleans only.
6. `[M]` Immediately deploy immutable normal:

```powershell
gh workflow run preview.yml --ref "<IMMUTABLE_RESTORE_WORKFLOW_REF>" `
  -f "ref=<IMMUTABLE_NORMAL_COMMIT>" `
  -f "safe_tail=false" `
  -f "configure_ai_budget=false"
```

7. `[RO]` Require exact normal attribution, exact-shape health, the two
   permanent schedules, temporary schedule absence, and unchanged protected
   backup-key version.
8. `[D]` Only after Step 7, explicitly confirm deletion of the two temporary
   restore secrets, then verify absence by name. Never inspect or rotate
   `<PROTECTED_BACKUP_KEY_NAME>`.
9. `[D]` Opaque marker deletion is blocked by the ordering conflict listed
   below. Retain it until that conflict is resolved. Never list, read, modify,
   or delete any protected backup object.

Any restore failure burns the one attempt and forbids automatic retry. Restore
normal immediately; retain the disposable branch; retain provider cleanup
targets until containment is proved; record only a closed category.

## Ordered acceptance matrix after restore containment

1. `[M]` After normal runtime and restore containment are verified, ask the
   user to create exactly one disposable event in the secondary Vision
   calendar. Do not record its content or provider identity.
2. `[RO]` Start `foundation_probe` observer.
3. `[M]` Deploy `deploy_foundation` with the active observer identifier.
4. `[RO]` Accept one foundation record, then `[M]` dispatch rollback
   immediately and prove normal.
5. `[D]` Only after rollback proof, ask the user for explicit confirmation and
   delete the disposable event. Verify only a safe absence/count fact.
6. For each fault in the exact order above: `[RO]` start a new `preview_fault`
   observer, `[M]` deploy one `deploy_fault`, `[RO]` accept one terminal,
   `[M]` rollback immediately, and `[RO]` prove normal before continuing.
7. `[RO]/[M]` Capture normal synchronization timing and deliberately
   missed-signal repair. The checked-in plan does not define the exact
   notification-suppression action, timing threshold, or safe controller
   procedure; this is a blocker rather than permission to improvise.
8. `[M]` With no temporary candidate active and normal proved, perform the
   current Google UI sequence: wrong-account denial, approved-account return,
   permission revocation, disconnected-state verification, and reconnection.
   The current UI labels and exact wait points are not in the checked-in plans;
   present verified current instructions and request explicit confirmation
   immediately before permission revocation.
9. `[RO]` Start a new `ai_usage` observer.
10. `[M]` Deploy `deploy_ai`. Only after candidate attribution and with the
    observer still active, obtain separate explicit approval for exactly one
    harmless AI request. Never record prompt or response content.
11. `[RO]` Accept one AI record and aggregate cost facts, then `[M]` rollback
    immediately and `[RO]` prove normal.
12. Enter Task 8 only when every entry criterion below is true.

## Privacy-safe terminal evidence

Copy only the named fixed facts from the named allowlisted listener step; never
copy a full workflow log.

- Calendar maintenance: evidence type, `outcome`, `category`,
  `repairOutcome`, and `renewalOutcome`.
- Role probe: evidence type, success/none, and `roleMatches=true`.
- Restore: evidence type, success/none, approved format/schema/key versions,
  aggregate and per-table nonnegative counts, and fixed verification booleans.
- Foundation: evidence type, success/none; role/schema/privilege/protected
  storage/backup-contract booleans true; zero public grants and zero identity,
  domain, privacy, provenance, reference, and checkpoint violations; sentinel
  passed; nonnegative database bytes, object count, and storage bytes.
- AI usage: evidence type, success/none; nonnegative aggregate monthly cents;
  fixed warning/stop thresholds; aggregate tier; Gateway-limit match true; and
  non-AI availability true.
- Faults: evidence type, exact scenario, `outcome`, and `category`. The five
  diagnostic-overlay scenarios expect success/none. The storage-upload fault
  expects failed with the closed storage-write category. This proves injected
  behavior, not a real provider outage.
- Rollback: fixed booleans for normal health, authenticated reads, exactly two
  permanent schedules, temporary schedule absence, temporary binding absence,
  and exact commit attribution. Do not record the commit or run identifier in
  the evidence document.

Safe operational evidence may also include UTC timestamps, elapsed
milliseconds, bounded counts, schema/key versions, and yes/no confirmation
facts. It may not include event content, raw rows, log envelopes, connection
data, account/owner/branch/run/object identifiers, deployment locations,
provider responses, or raw error text.

## Confirmation gates

The role-probe and fenced-restore plans treat their reviewed sequence as already
approved; do not ask the user to re-authorize each ordinary step. Immediately
before every candidate, however, the controller must explicitly confirm the
frozen ref, matching active observer, authenticated reads, normal provider
state, safe UTC window, and prepared rollback. A false or unknown proof stops
the dispatch.

Request action-time user confirmation before:

- creating or deleting the disposable calendar event;
- issuing the one harmless AI request;
- revoking authorization and later reconnecting it;
- permanently deleting either temporary secret;
- deleting the opaque attempt marker after its ordering is resolved;
- permanently deleting the disposable database branch.

Configuring the AI budget requires a separate explicit approval if the existing
approval does not already cover it. Beginning Task 8 requires confirmation that
all entry criteria are true and that the approved cleanup plan is the active
instruction.

The rollback dispatch is the pre-approved containment action after a candidate
terminal/failure/uncertainty and must not wait for a fresh cleanup approval.

## Abort and containment rules

- Before deployment: if any immutable-ref, local gate, authenticated-read,
  normal-provider-state, observer, or timing proof is false or unknown, do not
  deploy. If temporary secrets were created, restore/verify normal first and
  delete them only under the applicable explicit confirmation.
- After any deployment attempt: missing, duplicate, mixed, malformed, failed,
  mismatched, or uncertain terminal evidence triggers immediate normal rollback.
- If rollback is failed or uncertain: stop the matrix, keep the branch and
  marker, do not delete secrets unless the normal runtime is independently
  proved, do not perform user cleanup, and do not start Task 8.
- If the observer ends or is cancelled before terminal acceptance: rollback and
  stop.
- If the blocked UTC window is reached before deployment: do not deploy. If a
  temporary candidate may already be active, rollback and stop.
- Never retry the fenced restore automatically.
- Never infer a real database, storage, queue, or AI-provider outage from an
  injected fault.
- Never expose provider text while diagnosing. Record one approved closed
  category and create a value-free setback record.

## Task 8 entry criteria

All must be true:

- every role-probe and fenced-restore terminal was accepted exactly once;
- normal rollback after role and restore is fully proved;
- the foundation terminal is accepted, normal rollback is proved, and the
  disposable event is removed afterward;
- all six fault terminals are accepted in order, each with its own observer and
  fully proved rollback;
- normal synchronization timing and missed-signal repair have fresh safe
  evidence under a reviewed procedure;
- wrong-account denial, revoked/disconnected behavior, and reconnection have
  fresh safe evidence;
- the AI terminal, separately approved harmless request, aggregate cost facts,
  and rollback are complete;
- normal health, authenticated reads, exactly two permanent schedules, and
  absence of temporary schedule/binding are freshly proved;
- no observer, candidate, rollback, or provider cleanup operation is active or
  uncertain;
- all setbacks are contained and the evidence map uses only the safe categories
  above;
- the post-acceptance worktree is clean and based on the exact reviewed head;
- the marker-deletion ordering conflict below has an explicit reviewed
  resolution.

Task 8 then begins with the plan's exact read-only discovery and intentional RED
check:

```powershell
git grep -l -I -e 'vision.phase-b-foundation-probe/v1' -e 'vision.ai-usage/v1' -e 'vision.preview-fault/v1' -e 'temporary-preview-role-probe' -e 'temporary-preview-restore' -e 'PREVIEW_ACCEPTANCE_' -- src tests scripts .github wrangler.jsonc docs/reference
pnpm.cmd exec vitest run --project unit tests/security/temporary-surface-cleanup.test.ts
```

After explicit approval, Task 8 removes only enumerated temporary surfaces and
retains authentication, owner scope, normal diagnostics, measured usage,
permanent maintenance evidence, bounded ordinary observation, backup/import and
offline restore tooling, observer/mutation separation, normal schedules, and
the protected backup key/version.

The post-cleanup gate is:

```powershell
pnpm.cmd exec vitest run --project unit tests/security/temporary-surface-cleanup.test.ts tests/unit/server/wrangler-routing.test.ts tests/unit/ci/workflows.test.ts tests/unit/scripts/safe-tail-classifier.test.ts tests/unit/scripts/print-safe-tail.test.ts tests/security/secret-bundle.test.ts
pnpm.cmd docs:check
pnpm.cmd build
pnpm.cmd security:scan
pnpm.cmd test:e2e
pnpm.cmd check
```

Then obtain a fresh exact-diff review with zero Critical and zero Important
findings, commit/push the reviewed cleanup, and use the post-cleanup workflow
contract to deploy normal. Do not pre-use the current temporary workflow command
after Task 8 because Task 8 intentionally changes that workflow. Verify normal
health, authenticated reads, exactly two schedules, and absence of temporary
bindings and Worker secrets before any destructive provider cleanup.

Final `[D]`: only after all cleanup deployment proofs, show the user the current
database-provider UI instructions, resolve the already-attested disposable
branch privately, reconfirm it is disposable and not the normal preview branch,
request explicit confirmation at action time, delete only that branch, and
verify only that the branch count decreased by one and the retained target is
absent.

## Ambiguities and blockers

1. **Opaque marker deletion order conflicts.** The live sequence and immutable
   restore plan place deletion immediately after normal restore and secret
   removal. Task 8 and the cleanup map require clean normal deployment before
   marker deletion. Do not delete it until one ordering is explicitly selected
   and independently reviewed. Retention is the safe containment state.
2. **Legacy immutable observer binding needs reconfirmation.** The role and
   restore workflows use `ref`/`safe_tail`; the current workflow does not expose
   role/restore observer or deploy operations. Before dispatch, prove that each
   `<IMMUTABLE_*_WORKFLOW_REF>` makes the observer checkout the same immutable
   candidate commit supplied to `ref`. If that cannot be proved, do not run the
   legacy candidate.
3. **Observer-run resolution is underspecified.** The current candidate requires
   a numeric active observer run input, but the plan does not prescribe one
   privacy-safe command that uniquely resolves it. The controller must use a
   reviewed workflow/ref/event/commit/dispatch-time match and retain the result
   in memory only.
4. **Normal sync and missed-signal repair lack a live procedure.** No exact
   safe notification-suppression action, start/stop timestamps, threshold, or
   rollback is specified.
5. **Google current-UI labels and wait points are absent.** Wrong-account,
   revocation, disconnected verification, and reconnection need current
   provider UI instructions at execution time; do not guess labels.
6. **AI request versus scheduled terminal timing is not fully specified.** The
   request must occur while the candidate and observer are active, but the plan
   does not define how to prevent the one-minute terminal from arriving before
   the separately approved request. Resolve this timing before dispatch.
7. **Task 8 changes the workflow contract.** Its final normal-deploy command
   cannot be frozen in advance. Review the post-cleanup workflow and use its
   actual normal-only inputs.

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
