# Claude Code Continuation Handoff: Vision

Use this entire file as the controlling continuation prompt for Claude Code.
It records the confirmed project state at the handoff boundary on 2026-08-01.
Continue from this point; do not restart Phase B, rewrite already accepted work,
or repeat a live action merely because its evidence is hard to locate.

## Your mission

Finish Vision Phase B safely and completely by executing the frozen live
acceptance and closure plan:

1. Execute Task 8 observer-first live acceptance.
2. Execute Task 9 exact temporary-surface cleanup, independent review, commit,
   and privacy-safe push.
3. Execute Task 10 exact cleanup deployment, normal-state proof, provider
   cleanup, final evidence, independent review, commit, privacy-safe push, and
   Phase C handoff.

Continue until every documented Phase B terminal condition has current proof
or one concrete external/user-input blocker remains. Do not declare Phase B
complete from historical evidence or from passing local tests alone.

This handoff is authoritative for the remaining Phase B work. After Phase B,
use the reviewed `docs/operations/phase-c-handoff.md` and `PROJECT_PLAN.md` as
the starting point. Do not invent an unapproved Phase C scope or begin later
features before Phase B is genuinely closed.

## First message to the user

Say, in plain language:

> I have the exact handoff. Task 7 is complete, independently reviewed, and
> safely pushed. I am resuming at Task 8 live acceptance. The first local Task
> 8 provider driver is quarantined after an independent safety review; no live
> mutation occurred. I will preserve the reviewed commit, never expose secret
> values or private calendar data, never rotate backup key version 1, and ask
> for a fresh approval only immediately before the few owner-only actions
> required by the frozen plan.

Do not ask the user to restate project history or repeat approvals that the
current action does not require.

## Exact workspace and Git state

- Repository: `June74/Vision`
- Working branch: `codex/phase-b-foundation`
- Existing linked worktree:
  `C:\Users\2006i\OneDrive\Documents\AI calendar (secretary) project\.worktrees\phase-b-foundation`
- Exact admitted Task 7 candidate and current `HEAD`:
  `10b228bc2c18647f6a8a19c2dd5ad740e7f7491e`
- Frozen authoring base and expected Task 7 remote parent:
  `44d8e93802ce834fd0c8ca620d81472e23431b00`
- Local and remote `codex/phase-b-foundation` both pointed to the exact admitted
  Task 7 commit at handoff.
- The fresh whole-range review reported zero Critical, Important, and Minor
  findings and `EXACT_TIP_REVIEW=PASS`.
- The permanent privacy-safe push adapter returned only `True`.
- No Task 8 provider action, workflow dispatch, deployment, calendar edit,
  restore attempt, revocation, AI request, or provider cleanup occurred after
  that admission.

Enter the worktree exactly:

```powershell
Set-Location -LiteralPath 'C:\Users\2006i\OneDrive\Documents\AI calendar (secretary) project\.worktrees\phase-b-foundation'
```

Do not work from the parent checkout. Do not create another worktree or branch.

Use these Git options for local reads on this Windows host:

```powershell
$gitArgs = @(
  '-c',
  'safe.directory=C:/Users/2006i/OneDrive/Documents/AI calendar (secretary) project/.worktrees/phase-b-foundation',
  '-c',
  'core.excludesFile=/dev/null'
)
git @gitArgs status --short
git @gitArgs branch --show-current
git @gitArgs rev-parse HEAD
```

Never use `NUL` as `core.excludesFile` on this host. Never use
`git reset --hard`, `git checkout --`, broad clean commands, or an operation
that discards user or setback-ledger changes.

## Expected working-tree changes at handoff

The exact Task 7 commit is intentionally followed by eleven local
setback-ledger paths:

```text
M  docs/operations/setbacks/INDEX.md
M  docs/operations/setbacks/incidents/2026-07-27T202807Z-powershell-node-e-quote-loss.md
M  docs/operations/setbacks/incidents/2026-07-28T030600Z-cloudflare-secret-list-authentication-unavailable.md
M  docs/operations/setbacks/incidents/2026-07-31T145947Z-controller-repair-search-truncation.md
M  docs/operations/setbacks/incidents/2026-07-31T195503Z-task4-agent-skill-root-mismatch.md
?? docs/operations/setbacks/incidents/2026-08-01T030147Z-task8-read-wrapper-and-broad-search.md
?? docs/operations/setbacks/incidents/2026-08-01T172153Z-task8-safe-git-assert-tip-failed-closed.md
?? docs/operations/setbacks/incidents/2026-08-01T172546Z-task8-provider-driver-review-failed.md
?? docs/operations/setbacks/incidents/2026-08-01T173247Z-task8-static-callback-uri-output.md
?? docs/operations/setbacks/incidents/2026-08-01T173346Z-task8-preview-config-check-failed.md
?? docs/operations/setbacks/incidents/2026-08-01T173630Z-phase-b-progress-denominator-change.md
```

These files record local read-wrapper, broad-search/truncation, wrong-skill-root,
literal-pattern, and handoff-preparation recurrences. They contain no provider
payload, secret, private calendar content, deployment, or live mutation.

Preserve them as unrelated unstaged paths during Tasks 8-10. Do not commit them
before Task 9: changing `HEAD` would invalidate the exact Task 7 candidate and
Task 9's required parent. Task 9 explicitly preserves unrelated unstaged
paths, and Task 10 stages exactly four evidence/handoff files. Before the final
completion claim, reconcile these durable records without weakening the frozen
parent/tree checks. If that reconciliation would require changing the frozen
Task 10 sequence, stop and obtain one explicit owner decision rather than
silently folding them into an unrelated reviewed tree.

If the working set differs from the eleven paths above, classify every additional
path before proceeding. Do not assume it is disposable.

Three ignored local files also exist and must remain untracked:

```text
.superpowers/local/task8-provider-driver.mjs
.superpowers/local/task8-driver-selftest.mjs
.superpowers/local/2026-08-01-task7-dispatch-correlation-repair-plan.md
```

They are quarantined from live mutation until the repair below passes fresh
adversarial tests and independent review.

## Local resource limit

The owner has an AMD Ryzen 5 3600 (6 cores) and requested conservative local
resource use. Run at most one subagent at a time, meaning two active agents
total including the primary agent. Never overlap heavy builds, full test runs,
browser automation, or provider drivers. Prefer serialized bounded commands.

## Read these files completely before any live action

Read long files in bounded consecutive ranges through end of file. Do not rely
on truncated output.

1. `docs/superpowers/specs/2026-07-29-phase-b-live-acceptance-closure-design.md`
2. `docs/superpowers/plans/2026-07-29-phase-b-live-acceptance-closure.md`
3. `.superpowers/sdd/live-acceptance-global-constraints.md`
4. `.superpowers/sdd/task-8-brief.md`
5. `.superpowers/sdd/task-9-brief.md`
6. `.superpowers/sdd/task-10-brief.md`
7. `.superpowers/sdd/task-7-report.md`
8. `.superpowers/sdd/progress.md`
9. `docs/operations/phase-b-evidence.md`
10. `docs/operations/calendar-setup-evidence.md`
11. `docs/operations/credential-change-log.md`
12. `docs/operations/secrets.md`
13. `docs/operations/restore-drill.md`
14. `docs/operations/cost-review.md`
15. `docs/operations/setbacks/INDEX.md` and every open/contained incident
    relevant to Tasks 8-10.

Also inspect `CLAUDE.md`, `AGENTS.md`, or other repository instruction files if
they are later added. None was found at this handoff boundary.

The 2026-07-29 design and plan are frozen and must remain byte-identical to
authoring commit `44d8e93`. If a progress summary conflicts with the frozen
plan, follow the plan and safely record the discrepancy. Some tracked progress
text is intentionally stale until Task 10; do not edit it early merely to make
the narrative look current.

## Product and architecture context

Vision is a private AI secretary and unified calendar application.

- Version 1 serves one private user.
- React frontend and Hono API.
- Cloudflare Workers, Queues, schedules, and R2.
- Neon PostgreSQL with Drizzle ORM.
- Google OAuth and Google Calendar.
- Managed-services budget target of roughly $20/month.
- Preview AI Gateway hard limit: $9.50 per fixed 30-day period.
- Information categories: personal, work, or school.
- Near-real-time Google Calendar synchronization is a Phase B requirement.
- Phase B synchronization remains read-only after setup: no event create,
  edit, move, cancel, or delete route/control is allowed.
- Direct calendar editing, the privacy-safe shared/company calendar, mobile,
  and desktop apps are later goals.

The live preview schema is current through migrations `0001`-`0009`. Migrations
`0004`-`0009` were applied to preview Neon. Real Google OAuth admission and
session persistence succeeded. A secondary Vision calendar was connected and
verified with zero events. An encrypted R2 backup was verified. A disposable
schema-only Neon restore branch and a replay marker were retained for final
closure. These are historical facts and must be reconciled read-only before
acting; do not assume provider state is unchanged.

## Non-negotiable privacy and safety boundary

Never print, request in chat, paste into a file, preserve in logs, or include
in evidence:

- secret or credential values;
- database connection strings;
- OAuth codes, access tokens, refresh tokens, ID tokens, cookies, or sessions;
- auth-bearing or callback URLs;
- email addresses or Google subject identifiers;
- encryption keys;
- provider resource identifiers or run handles;
- R2 object keys;
- database rows;
- private event content;
- AI prompts or responses;
- raw request/response bodies, provider responses, or raw logs.

Allowed Task 8 evidence is limited to closed categories/state labels, booleans,
bounded counts/deltas, durations, canonical UTC timestamps/scheduled instants,
name-only temporary-secret facts, safe request status, and the immutable commit
reference. Keep observer/run handles only in process memory.

Managed configuration already exists. Inspect secret names/types only when the
frozen plan requires it. Never inspect their values. Existing categories
include database, Google OAuth/allowlist, application encryption, backup
encryption, time-zone, and preview provider credentials.

The backup encryption key must remain at version `1`. The user explicitly
forbids rotating it. Do not read, replace, delete, echo, request, or rotate its
value. Record any future key-related change by safe name/category only in
`docs/operations/credential-change-log.md`.

Never retry a completed, failed, or uncertain fenced restore or AI acceptance
request. Reconcile first. Any missing, duplicate, mixed, late, misattributed,
or uncertain live evidence is a hard stop. If a temporary candidate may still
be active, restore the normal artifact first using the frozen rollback path.

## Approval contract

The user authorized the overall Phase B completion workflow, migrations,
disposable restore resources, and the $9.50 acceptance path. The frozen plan
still requires a fresh action-time approval immediately before each owner-only
or destructive action below:

- entering temporary restore values, if the two approved temporary names are
  absent;
- deleting either temporary restore secret name;
- each disposable Google Calendar edit used for timing/repair proof;
- Google authorization revocation;
- reconnection/permission interaction;
- the single AI acceptance request;
- deleting the attested disposable Neon branch;
- deleting the replay marker last.

Ask once, immediately before the action. Explain simply:

1. what will change;
2. where it changes;
3. whether it is reversible;
4. what privacy-safe proof will be kept;
5. what happens next.

Do not repeatedly request the same approval. If the user must enter a value or
authenticate, give exact UI navigation and the safe field label they will see,
then let the user enter it directly. Never ask them to paste a value, connection
string, token, code, email, or auth URL into chat. The user alone handles Google
login and consent.

Ordinary read-only reconciliation and the frozen normal deployment do not need
an extra product approval, although the execution environment may still require
a scoped tool/network permission.

## Setback ledger policy

After any unexpected error, failed command, incorrect hypothesis, recurrence,
privacy concern, review finding, external blocker, or unplanned delay:

1. Stop and contain the affected action.
2. Search `docs/operations/setbacks/INDEX.md` for the same symptom/cause.
3. Append a recurrence to the existing incident, or create one incident under
   `docs/operations/setbacks/incidents/` if it is new.
4. Record only safe evidence.
5. Separate confirmed cause, hypothesis, and rejected hypothesis.
6. Record impact, correction, prevention, owner, and verification/next step.
7. Resume only after containment and durable logging.
8. Close only after the correction is verified.

Do not log an intentional test-driven-development RED failure that fails for
the expected reason.

Host-specific prevention rules:

- Use `[DateTime]::UtcNow.ToString('o')` for UTC timestamps.
- Use exact skill/tool paths; never reconstruct a catalog root from memory.
- Use bounded exact-file reads. Truncated output is not evidence.
- Do not combine large plan, spec, review, or test files in one output.
- Prefer `Select-String` when `rg` is unavailable or misassociated.
- Use repository-local `.cmd` launchers on Windows.
- `pnpm.cmd test:unit -- <file>` may run the entire unit project.
- For focused Vitest, use the proven repository-local executable shape from
  the current task brief/tests rather than guessing package-manager resolution.
- Wrangler's optional user-log permission warning is already classified. If
  the authoritative command exits zero, do not treat that warning alone as a
  product failure and never read the log contents.
- If an untracked generated `debug.log` appears, inspect safe metadata only,
  update the existing incident, delete exactly that generated file, and prove
  it is absent.

## Completed work and evidence boundary

All implementation through live-acceptance closure Task 7 is complete.

- Runtime, CI, canonical domain/data/privacy, OAuth/session/calendar setup,
  Google read synchronization, AI budget/diagnostics, encrypted recovery, and
  release foundations were implemented and independently reviewed.
- Live-acceptance closure Tasks 1-6 were implemented, tested, reviewed, and
  committed.
- Task 7 passed the complete focused and aggregate Gate 0 matrix.
- Final Task 7 exact-tip review: zero Critical, Important, and Minor findings.
- Exact Task 7 push: privacy-safe adapter returned only `True`.
- Normal preview and production artifacts each had exactly two schedules.
- Backup key version was `1` in both normal artifacts.
- No migration changes, new permanent secret names, Google event-write
  surfaces, protected-value violations, or unexpected R2 deletion callers were
  introduced.
- The cleanup classifier currently covers 184 paths: 98
  `delete_dedicated`, 51 `unwind_shared`, 23 `retain_permanent`, and 12
  `retain_historical`. Task 9's exact changed-path manifest has 149 paths.
- Strict pre-cleanup mode is intentionally RED for exactly the reviewed
  temporary residue. This is not a product regression.

The authoritative Task 7 record is `.superpowers/sdd/task-7-report.md`. The
tracked `docs/operations/phase-b-evidence.md` still contains pre-Task-8 pending
rows by design; Task 10 is responsible for the final reviewed update.

## Exact Task 8 resume state

Task 8 is pending. `.superpowers/sdd/task-8-report.md` does not exist yet. A
read-only reconciliation attempt found the expected local controller contracts.
An ignored local closed-output driver and self-test were then written; the
self-test passed 5/5, but an independent static safety review failed the driver.
The driver is quarantined. It was used only for a read-only candidate lookup,
which returned a closed `null`; no provider mutation occurred.

The review found three Critical and three Important issues:

- approval/action controls were replayable rather than nonce-bound,
  candidate-bound, expiring, atomic, and single-use;
- provider run handles could appear in stdout instead of remaining behind an
  opaque local token;
- dispatch attribution could race by selecting the first unseen run rather
  than an exact commit, event, operation, and correlation tuple;
- rollback closure was not tied to the exact candidate correlation;
- dispatch context validation was not an exact closed schema; and
- the self-test lacked isolated control storage and adversarial liveness,
  stderr, replay, expiry, attribution, and malformed-control assertions.

The owner has been shown the original repair design but has not yet approved
implementation. Do not edit the ignored driver or tracked workflow/controller
until the owner explicitly approves the revised design. A scoped, closed-output
provider probe subsequently proved that workflow-run details expose no dispatch
inputs. Current official provider documentation supports an exact run identifier
on a successful dispatch, but a response lost after server acceptance remains
ambiguous because there is no documented input echo or idempotency mechanism.

The revised recommended repair is TDD first: add one minimal tracked correlation
value to the canonical dispatch context and immutable candidate/rollback
evidence; use the direct provider run identifier on ordinary success; reconcile
an uncertain dispatch only by the exact correlation; and keep owner controls,
opaque local handle mapping, and adversarial driver tests local and ignored.
This is a Task 7 safety-fix wave, not an early Task 8 source edit. It invalidates
the admitted tip and requires the complete Gate 0 freeze, fresh independent
zero-Critical/zero-Important review, commit, privacy-safe push, and equality
proof again before Task 8 resumes.

Three Chrome handoff tabs were prepared and finalized: Vision preview sign-in,
Cloudflare login, and Neon console. At this boundary they were signed out. The
owner has not yet confirmed that all three are signed in. If they say login is
done, reclaim only those visible tabs and continue read-only reconciliation;
never inspect cookies, storage, passwords, auth URLs, codes, tokens, emails, or
secret values.

Confirmed local surfaces include:

- observer resolver/state validation;
- safe-tail classification;
- synchronization timing validation;
- restore readmission controls;
- normal deployment path;
- cleanup inventory;
- page-scoped AI request validation.

Current pre-cleanup workflow operations include normal `none`, `observe`,
candidate deployments, `rollback`, `close_rollback`, and `verify_cleanup`.
Do not assume `verify_cleanup` is a generic Task 8 preflight; prove its exact
contract before using it.

`scripts/run-preview-normal-deploy.ts` is a tested permanent module that takes
injected provider-command dependencies. It is not automatically a ready CLI.
Task 10 requires it after Task 9 removes the temporary controller. Before
building any local adapter, inspect the current interfaces and tests. Keep the
provider bridge local/ignored and closed-output. The only tracked pre-Task-8
exception now proposed is the owner-approved correlation repair above; do not
make unrelated tracked changes.

Provider-interface selection order:

1. Use an existing purpose-built connector/API if it can dispatch and verify
   the exact workflow while returning only allowlisted fields.
2. Otherwise use the authenticated GitHub CLI through a local ignored driver
   that captures/discards child stdout and stderr and returns only the fixed
   safe shape expected by the tested controller.
3. Use browser control only if the connector/API/CLI cannot perform the
   operation. Never inspect cookies, storage, passwords, or auth material.
4. If authentication is required, pause while the user signs in themselves.

Do not print workflow run IDs, provider artifacts, provider URLs, or raw
command output. Discover tools with exact names/descriptions and names-only,
strictly limited results; broad tool-metadata discovery already caused a
logged truncation.

The first live mutation after successful reconciliation is the frozen normal
preview deployment of exact commit `10b228b` through operation `none`, followed
by its normal-state proofs. It is not an owner-only action-time approval.

## Task 8 execution order

Follow `.superpowers/sdd/task-8-brief.md` and frozen plan Task 8 exactly:

1. Reconcile bounded signed-in normal state, the safe evidence map, replay
   marker existence, and disposable-branch state. Reuse valid immutable
   evidence. Never retry uncertain restore or AI actions.
2. Deploy and prove the exact reviewed normal artifact: health, signed-in
   diagnostics/calendar reads, exactly two schedules, no temporary binding,
   and no one-minute dispatch.
3. Capture one permanent maintenance-v2 baseline. Start the observer five to
   two minutes before an exact quarter-hour tick and observe through tick plus
   120 seconds. Accept exactly one terminal for that exact instant.
4. Complete the role probe and fenced restore as one same-commit atomic pair.
   Revalidate disposable target, replay fence, and single-attempt state before
   restore. If temporary restore secret names are absent, the owner enters the
   values only after action-time approval; automation checks name/type only.
   After pair closure, separately approve deletion of both temporary names and
   prove strict normal state.
5. Run the foundation candidate and all six frozen fault candidates: delayed
   Queue work, failed synchronization, channel expiry, database outage, R2
   upload failure, and AI budget stop. Every candidate must close independently.
6. Prove normal synchronization after a fresh maintenance tick. Obtain one
   60-second approval for a harmless disposable calendar edit, freeze other
   edits, poll signed-in Vision state every five seconds, and require visibility
   within 120 seconds and before the next maintenance tick with zero
   retry/failure counter deltas.
7. Prove one deliberately missed signal and repair. Satisfy the frozen
   five-minute/four-minute pre-edit timing gates, rollback deadlines, full
   uniqueness window, first eligible repair tick, reserved repair outcome,
   visibility boundary, and zero counter deltas.
8. Complete the authentication lifecycle: read-only control discovery,
   wrong-account denial without identity details, separately approved
   revocation, unambiguous disconnected state, owner-only reconnect/consent,
   and restored connected/signed-in/two-schedule/no-temporary proof.
9. Prove one causal AI request. Require zero active requests, start both
   observers before candidate deployment, verify exact attribution and the
   saved $9.50 limit, obtain one 60-second action-time approval, perform one
   page-context request, abort at 35 monotonic seconds, discard bytes, and
   never retry. Require exactly one created and one eligible-settled aggregate,
   timely rollback, and one terminal over the expiry-plus-three-minute
   uniqueness close.
10. Classify every gate as proved, contradicted, incomplete, or missing. Task 9
    may begin only when every pre-cleanup requirement is proved.

Every temporary candidate uses this lifecycle:

```text
observer active
-> immutable candidate attribution
-> approved action or bounded evidence
-> normal rollback
-> normal-state and signed-in proofs
-> separate rollback closure
```

Append only privacy-safe facts to one ignored local Task 8 evidence file. Do
not update tracked evidence or edit source in Task 8. Preserve the replay marker
through all of Task 8, Task 9, cleanup deployment, and final normal proof.

## Task 9: exact source cleanup only

Task 9 begins only after every Task 8 pre-cleanup item is proved.

1. Use `PHASE_B_ACCEPTANCE_PATH_CLASSIFICATION` and
   `task9ChangedPathManifest()` as the sole path authority.
2. Confirm ordinary inventory GREEN.
3. Run strict cleanup mode and accept the intentional RED only when it reports
   exactly the reviewed residue.
4. Delete every `delete_dedicated` path and surgically unwind every
   `unwind_shared` path. Never touch `retain_permanent` or
   `retain_historical`.
5. Preserve normal auth/owner scope, webhook/Queue/sync/repair, normal AI
   accounting and the $9.50 hard stop, recovery/import/offline restore,
   maintenance-v2 evidence, exactly two schedules, permanent normal-deploy
   runner, privacy-safe Git adapter, R2 scanner, cleanup/closure tests,
   references, and frozen history.
6. Reduce `.github/workflows/preview.yml` to the single immutable reviewed
   normal-deploy path specified by the frozen plan. Remove all acceptance
   inputs/jobs and temporary operations.
7. Turn strict cleanup mode GREEN and run the complete post-cleanup local,
   browser, security, preview-build, production-build, and deployment-config
   gates from the exact frozen Task 9 commands.
8. Generate the changed paths only from the reviewed 149-path manifest. Stage
   only those literal paths and preserve unrelated unstaged setback files.
9. Obtain an independent cached-diff security/release review with zero Critical
   and zero Important findings. Any edit/restage invalidates the review.
10. Commit the exact reviewed parent/tree and push only through
    `scripts/privacy-safe-git-remote.ts`; require the sole equality output
    `True`.

Task 9 performs no live deployment and no provider cleanup. It receives no
deletion capability. Write `.superpowers/sdd/task-9-report.md` with safe
verification, manifest, review, parent/tree, commit, and safe-push facts.

## Task 10: deploy, provider cleanup, evidence, and handoff

Task 10 begins only after the exact Task 9 cleanup tree is independently
approved, committed without post-review changes, and safely pushed.

1. Deploy that exact cleanup commit through the permanent
   `scripts/run-preview-normal-deploy.ts` boundary. Prove branch-tip equality,
   exactly one matching run, immutable head/workflow/checkout equality, the
   exact fixed attribution schema, and boolean-only success.
2. Re-prove normal preview: health, signed-in diagnostics/calendar reads,
   exactly two schedules, no temporary binding, no temporary Worker secret,
   and no one-minute dispatch.
3. If either approved temporary restore secret name remains, obtain separate
   action-time approval and delete only those names without reading values.
4. While the replay marker still exists, obtain action-time approval and have
   the owner delete only the privately attested disposable Neon branch. Prove
   count decreased by one and selected target absence.
5. Only after branch absence, obtain a separate approval and delete the sole
   opaque replay marker. Prove safe absence and object-count decrease by one.
   Never touch the protected backup prefix, encrypted backups, or backup key.
6. Update exactly:
   - `docs/operations/phase-b-evidence.md`
   - `docs/operations/calendar-setup-evidence.md`
   - `docs/operations/credential-change-log.md`
   - `docs/operations/phase-c-handoff.md`
7. Transfer only reviewed safe facts: categories, booleans, non-sensitive
   counts/durations/timestamps, name-only temporary-secret changes, key version
   1, and immutable candidate/cleanup commits.
8. Stage exactly those four files; run the frozen documentation, security, and
   three closure tests against that exact tree; independently review with zero
   Critical and zero Important findings.
9. Commit only the reviewed tree, prove parent/tree equality, and push only
   through the permanent safe adapter. Require boolean local/remote equality.
10. Run the completion audit. Phase B is complete only when no explicit
    requirement, gate, invariant, deployment state, provider cleanup item, or
    evidence row is contradicted, incomplete, indirect, missing, or ambiguously
    owned.

The fixed provider cleanup order is:

```text
reviewed Task 9 cleanup push
-> exact cleanup deployment
-> normal preview proofs
-> disposable Neon branch deletion and absence proof
-> replay marker deletion last and absence proof
-> final tracked evidence review and safe push
```

## Verification commands

Use the exact focused commands from each task brief. The complete post-cleanup
Task 9 gate is:

```powershell
pnpm.cmd typecheck
pnpm.cmd test:unit
pnpm.cmd test:contract
pnpm.cmd test:worker
pnpm.cmd docs:check
pnpm.cmd security:scan
pnpm.cmd test:e2e
pnpm.cmd check
& { $env:CLOUDFLARE_ENV='preview'; pnpm.cmd build }
pnpm.cmd deploy:check:preview
& { $env:CLOUDFLARE_ENV='production'; pnpm.cmd build }
pnpm.cmd deploy:check:production
```

Do not rerun deleted Task 1-6 focused paths after Task 9. Do not treat the
intentional pre-cleanup strict RED as a final failure. Do not claim success from
an old run; record fresh exit results for the exact tree being reviewed.

Before any completion claim, apply the project's verification-before-completion
discipline: run the relevant commands, inspect final exit results, compare the
actual tree/commit/provider state to the frozen requirements, and report only
what the evidence proves.

## Git and review rules

- Never use direct `git push` or `git ls-remote` for remaining Phase B work.
- Use `scripts/privacy-safe-git-remote.ts` for remote-tip checks and exact
  pushes. Its child streams must remain captured/discarded.
- A successful equality/push proof emits only `True`.
- Never print a remote URL, provider output, command arguments containing
  protected data, or raw Git child output.
- Resolve full commit objects from Git; never infer a 40-character SHA from an
  abbreviation.
- Stage only the exact reviewed task manifest.
- Capture parent and index tree in one controller process before review and
  keep them unchanged through commit.
- Any edit or restage after approval invalidates the review.
- Every implementation task requires an independent specification/security
  and quality review. Critical and Important findings must both be zero.
- Preserve user changes and unrelated setback paths.

## What counts as a blocker

A real blocker names one concrete missing authority, manual owner action,
provider state change, or unavailable external dependency. Before stopping:

1. exhaust safe read-only checks;
2. reconcile whether the action already happened;
3. avoid repeating fenced/non-idempotent actions;
4. return to normal state if a candidate may remain active;
5. give the user exact UI steps when manual action is necessary;
6. state the safe evidence already preserved and the exact resume point.

Do not call the work blocked because it is lengthy, tests are slow, a normal
scoped tool permission is needed, or one safe alternative remains.

## Phase B completion language

Do not say "Phase B is finished," "done," "working," or "all good" until the
completion audit proves every frozen terminal condition. The final owner
summary must include only:

- the reviewed Task 7 candidate and Task 9 cleanup commits;
- boolean safe-push/local-remote equality;
- safe final deployment category;
- Task 8 closed acceptance categories and bounded timings;
- Task 9 temporary-surface closure;
- Task 10 branch-then-marker provider cleanup;
- backup key version `1` unchanged and the safe key-change record;
- zero Critical and zero Important final-review findings;
- the reviewed Phase C starting point.

It must not contain provider identifiers, URLs, object keys, private content,
prompts/responses, account data, database rows, credentials, or raw output.

## Immediate resume checklist

- [ ] Enter the exact linked worktree.
- [ ] Confirm branch and full `HEAD` equal the admitted Task 7 commit.
- [ ] Confirm local/remote equality only through the privacy-safe adapter.
- [ ] Reconcile the eleven expected setback-ledger paths; preserve them.
- [ ] Read the frozen design, plan, global constraints, and Task 8-10 briefs
      completely.
- [ ] Confirm `.superpowers/sdd/task-8-report.md` is absent.
- [ ] Build a privacy-safe Task 8 evidence map from existing immutable facts.
- [ ] Obtain explicit approval for the revised minimal tracked-correlation plus
      ignored-driver repair; write adversarial tests first.
- [ ] Rerun the complete Task 7 freeze, fresh independent zero-Critical/zero-
      Important review, commit, privacy-safe push, and equality proof before any
      Task 8 live mutation.
- [ ] Keep at most one subagent active and serialize heavy local commands.
- [ ] Confirm the owner has signed in to the prepared Vision, Cloudflare, and
      Neon Chrome tabs before reclaiming them for read-only reconciliation.
- [ ] Reconcile signed-in normal state, replay marker, and disposable branch.
- [ ] Deploy/prove exact reviewed normal artifact.
- [ ] Continue Task 8 in the frozen sequence, pausing only at action-time owner
      approvals.
- [ ] Do not begin Task 9 until every Task 8 pre-cleanup gate is proved.
