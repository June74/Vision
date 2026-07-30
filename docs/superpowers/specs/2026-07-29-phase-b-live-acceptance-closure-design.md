# Phase B Live-Acceptance Closure Design

**Status:** Owner-approved written specification

**Phase:** B — foundation, authentication, synchronization, recovery, and
operational acceptance

**Execution:** Test-first, subagent-driven implementation with independent
security and release review

**Live boundary:** Preview only until every temporary acceptance surface is
removed and the reviewed normal Worker is redeployed

## Goal

Close the remaining Phase B live-acceptance gaps without exposing protected
data, weakening authentication, creating a permanent operator API, rotating the
backup key, or allowing temporary acceptance code to delete a protected backup.

The design must produce truthful live evidence for:

1. ordinary near-real-time Google Calendar synchronization;
2. recovery from one deliberately missed but authentic Google notification;
3. exactly one separately approved AI request and its aggregate cost evidence;
4. permanent calendar-maintenance behavior;
5. immutable observer and candidate attribution;
6. rollback, signed-in post-restore reads, and lifecycle closure;
7. safe post-acceptance removal of all temporary surfaces.

## Owner-approved backup policy

The phrase “acceptance must never delete `backups/v1/`” applies to temporary
acceptance instrumentation and acceptance execution. Temporary code, workflows,
scripts, candidates, observers, and cleanup must neither add nor invoke an R2
backup-delete path.

The existing permanent recovery rules remain approved:

- when a daily-backup invocation creates one object and independent verification
  of that same object fails, that invocation may delete only the object it just
  created; and
- normal retention may delete only validated backup objects older than the
  approved 30-day boundary.

No other backup deletion is authorized. `BACKUP_KEY_VERSION` remains version
`1`; the protected backup key is not read, printed, copied, or rotated.

A path-scoped structural contract enforces this boundary. It allowlists only
the two permanent deletion capabilities above and fails if any temporary
acceptance source, workflow, script, dependency factory, or cleanup helper can
import, inject, construct, or invoke R2 deletion.

The temporary current-workflow restore adapter uses a dedicated
`head`/`get`/`list` R2 catalog reader. After scheduled admission, its runtime
input contains only exact required scalars, that reader, and the pre-existing
replay-fence `claimOnce` capability under its fixed marker prefix. Broad `Env`,
a raw write-capable `R2Bucket`, backup-object `putIfAbsent`, `delete`, and the
delete-capable production object-store factory cannot cross the backup
catalog/read boundary. The replay fence is the sole permitted restore write
capability and does not authorize a retry.

## Confirmed live paths

The implementation extends reachable production paths:

```text
Verified Google notification
  -> registerGoogleCalendarWebhook()
  -> durable job reservation
  -> Cloudflare Queue
  -> consumer()
  -> syncCalendar()
  -> authenticated Vision event read
```

```text
Permanent 15-minute maintenance schedule
  -> scheduled()
  -> runScheduledCalendarMaintenance()
  -> repairCalendarSync()
  -> the same durable Queue and consumer path
```

```text
Authenticated Vision AI request
  -> registerAiCategoryProposalRoute()
  -> normal AI budget reservation and provider dispatch
  -> terminal usage-ledger transition
```

```text
Temporary AI evidence schedule
  -> scheduled()
  -> runScheduledPhaseBAiUsageEvidence()
  -> aggregate usage, status, and calendar reads
  -> one allowlisted terminal record
```

The current AI request path and scheduled AI evidence path are independent.
Without an additional gate, the one-minute schedule can emit before the
separately approved request. The current webhook path also has no bounded way to
prove live repair after intentionally suppressing one authentic signal.

## Chosen architecture

### 1. Dedicated missed-signal candidate

Add a preview-only `deploy_sync_suppression` operation. It is separate from the
closed six-scenario fault tuple and must not be represented as a seventh fault
scenario.

The generated candidate:

- keeps exactly the two permanent schedules;
- adds no one-minute schedule;
- carries one strict suppression selector and a canonical expiry;
- expires no later than ten minutes after generation;
- is admitted only when its complete lifetime stays outside the existing
  daily-recovery exclusion window;
- contains no new secret, public route, database table, Queue, or provider
  resource;
- is admitted only for the preview environment and an active matching observer;
- fails validation if combined with any fault, AI, foundation, role-probe, or
  restore selector.

The webhook suppression check runs only after the existing notification has
passed every authenticity, ownership, channel, token, resource, expiry, and
read-only durable replay check and has been classified as an `exists`
notification. Replay identity mirrors the normal owner, fixed-provider,
calendar, and reason tuple. The selector is resolved against a fresh clock read
after replay I/O. When active, it:

1. emits one fixed-shape, content-free suppression record;
2. returns success before durable job reservation;
3. never records headers, event content, calendar identity, channel identity,
   resource identity, message number, account data, or request body.

Invalid, pending-channel, expired, mismatched, replayed, `sync`, and
`not_exists` notifications never enter the suppression branch.

The candidate uses a bounded window rather than durable exact-once state. While
it is active, the controller prohibits unrelated calendar edits and dispatches
rollback within 60 seconds after a content-free first-seen signal. One
read-only observer workflow run contains a fast signal tail job and a separate
uniqueness tail job. The controller learns the signal only from the fast job's
allowlisted completion state and timestamp, never from its logs; the second job
continues through the complete 120-second uniqueness window and accepts only
exactly one suppression terminal. If the selector has expired, the webhook
follows the normal durable path; expiry never extends suppression.

At the scheduled entry point, the selector is still subject to the existing
whole-lifetime and protected-window guards. It does not replace normal
calendar-maintenance dispatch. Its ten-minute lifetime cannot overlap the daily
backup tick, so no daily recovery operation runs under this temporary binding.

Immediately before requesting approval for the disposable edit, the controller
revalidates the live candidate, observer, and protected-window exclusion and
requires at least five minutes of candidate lifetime. Approval expires after 60
seconds. Immediately after approval and before the edit, the controller repeats
those checks and requires at least four minutes of lifetime. The four-minute
floor reserves 120 seconds for observation, 60 seconds for rollback, and a
60-second safety margin. Failure of either check triggers rollback without
editing the event.

### 2. Normal synchronization proof

Use one disposable event in the private secondary Vision calendar. Event
content and provider identity remain private.

The normal test runs immediately after a completed maintenance tick:

1. prove normal health, connected authorization, signed-in diagnostics and
   calendar reads, two permanent schedules, no temporary binding, and unchanged
   failure counters;
2. obtain action-time approval for one disposable event change; approval
   expires after 60 seconds;
3. repeat the same state checks immediately after approval and before beginning
   the edit within that window;
4. record only UTC start and provider-confirmed completion timestamps;
5. poll the authenticated Vision event view every five seconds without copying
   its payload;
6. pass only if the changed version becomes visible within 120 seconds, before
   another maintenance tick, with no retry or failure-counter increase.

Failure to meet the threshold does not prove the push path. Stop and diagnose
with allowlisted facts.

### 3. Missed-signal repair proof

After the normal proof:

1. start a fresh `sync_suppression` observer and prove its listener active;
2. deploy the suppression candidate and verify exact live candidate
   attribution, normal schedules, its unexpired selector, and the observer;
3. revalidate the candidate, observer, daily-recovery exclusion, and five-minute
   remaining-lifetime floor;
4. obtain action-time approval for one private edit to the disposable event;
5. revalidate the same facts and the four-minute remaining-lifetime floor, then
   perform the edit;
6. poll only allowlisted observer-job state and, when the signal job succeeds,
   dispatch normal rollback within 60 seconds while uniqueness observation
   continues;
7. require exactly one suppression terminal when the full 120-second uniqueness
   window closes;
8. complete provider-state proof, signed-in post-restore reads, and the separate
   rollback-closure operation;
9. privately confirm the suppressed version is not yet visible;
10. use the safe last-successful-sync timestamp to calculate the first
   quarter-hour maintenance tick satisfying:

   ```text
   lastSuccessfulSyncAt <= eligibleTick - 15 minutes
   ```

11. re-read the anchor, recompute the tick, freeze it as canonical
    `maintenanceScheduledAt`, and start a fresh permanent-maintenance observer
    five minutes before it, with listener active no later than two minutes
    before and revalidated through that exact tick;
12. pass only if the first eligible record reports `repairOutcome=reserved`,
    it carries that exact scheduled event, its uniqueness window through
    `maintenanceScheduledAt + 120 seconds` contains no duplicate or other tick,
    the edited version becomes visible before the following quarter-hour tick,
    and retry and failure counters do not increase.

If the safe sync anchor changes before the calculated tick, recompute it. Record
only the eligible tick, safe timestamps, elapsed milliseconds, fixed booleans,
and bounded counters.

An ended observer, missing or duplicate suppression record, unexpected early
visibility, expired candidate, or uncertain deployment makes the attempt
inconclusive and requires immediate rollback. Failed or uncertain rollback
stops the sequence; retain the disposable event and perform no provider cleanup.

### 4. AI request-to-evidence gate

Keep the one-minute AI evidence schedule, but have the controller create one
canonical AI window before observer dispatch. The observer and generated
candidate receive the same canonical UTC `evidenceScheduledAt` and `expiresAt`
values as temporary workflow inputs and reject any drift. The handler may read
the ledger or emit evidence only when the scheduled-event timestamp exactly
equals `evidenceScheduledAt` and execution occurs before `expiresAt`. Candidate
validation requires:

```text
activatedAt < evidenceScheduledAt
evidenceScheduledAt < expiresAt < evidenceScheduledAt + 60 seconds
```

All earlier and later ticks perform no AI evidence reads and emit nothing.
This makes at most one scheduled instant eligible without adding durable
acceptance state. Duplicate delivery of that same scheduled event could still
emit twice, so acceptance requires exactly one observed terminal; a duplicate
makes the attempt inconclusive.

The window generator also requires the expiry plus the 60-second rollback bound
to avoid every permanent quarter-hour and daily schedule instant. This prevents
an expired candidate from blocking permanent work while rollback completes.

Add aggregate-only source operations equivalent to:

```text
countActiveRequests()
readCandidateRequestCounts(activatedAt, evidenceScheduledAt)
  -> createdRequestCount
  -> eligibleSettledRequestCount
```

Before candidate generation, `countActiveRequests()` must be zero. The
candidate operation returns both every owner reservation created at or after
`activatedAt` and strictly before `evidenceScheduledAt`, regardless of its
lifecycle status, and the subset dispatched normally, completed strictly before
`evidenceScheduledAt`, and confirmed in exact production status `settled`.
Completion and status filters apply only to the eligible subset; `reserved`,
`dispatched`, `released`, `settled_estimate`, and `settled` rows still count as
created when their creation instant is in-window. Pre-activation,
at/after-evidence, and foreign-owner creation is outside both counts.

Active admission remains owner-wide across accounting months. Existing ledger
consistency and candidate-month checks run inside the same snapshot; an
inconsistent lifecycle or in-window owner row outside the admitted Chicago
accounting month throws the closed `inconsistent` failure rather than being
filtered out. The candidate is rejected if its window can cross that month
boundary.

The pre-generation count is exposed only as a temporary, preview-only aggregate
on the existing authenticated diagnostics response. It adds no route or UI,
returns no reservation or request identity, and is removed in Task 9. During
the AI candidate it also reports only the created and eligible aggregates
needed to prove exactly one causal request settled before the evidence instant.

At the sole eligible scheduled instant:

- created `0`, eligible `0`: return without a terminal or
  status/calendar evidence reads; the live attempt is inconclusive;
- created `1`, eligible `0`: wait without a terminal;
- created `1`, eligible `1`: run the existing aggregate usage, status, and
  calendar reads and emit one existing `vision.ai-usage/v1` terminal record;
- either count greater than `1`, or any impossible relationship: emit the
  existing closed `inconsistent` failure and fail the candidate.

The activation boundary is derived from the existing fixed candidate lifetime
and canonical expiry and precedes observer dispatch. The controller freezes
every other AI action from the first zero-active proof through rollback closure
and uniqueness completion. Any second created reservation invalidates the
attempt.

The live sequence is:

1. prove zero active AI requests and generate one window far enough in the
   future for observer resolution, deployment, approval, and request completion;
2. start a fresh `ai_usage` observer with signal and uniqueness tail jobs bound
   to that window, and prove both listeners active;
3. deploy the candidate with the same window and verify exact attribution;
4. prove no terminal exists, zero active and zero candidate-window requests
   still hold, and both candidate and observer remain valid beyond the evidence
   instant;
5. privately select an authorized disposable event and prove the current AI
   tier permits the request;
6. obtain separate approval for exactly one request; that approval expires
   after 60 seconds;
7. immediately reverify the candidate, observer, zero-active/zero-created
   baseline, no terminal, and remaining time before the evidence instant;
8. issue one browser-scoped request through the existing authenticated route;
9. retain the session, anti-forgery value, event reference, and idempotency key
   inside the browser page context, then drain and discard the response body;
10. record only approval, request-start, and request-completion timestamps, a
   success boolean, and a bounded status class;
11. require private aggregate confirmation that created count is exactly one
    and the one request is exactly `settled` before `evidenceScheduledAt`;
12. when the signal job succeeds, immediately dispatch rollback; if it does not
    succeed, roll back no later than actual expiry and fail;
13. complete normal proof, signed-in reads, and rollback closure while the
    uniqueness job continues through `expiresAt + 3 minutes`;
14. require uniqueness completion with exactly one terminal from the sole
    eligible scheduled instant.

Never retry an uncertain request. The required ordering is:

```text
candidate verified
  < owner approval
  < request started
  <= request completed
  < evidenceScheduledAt
  <= accepted terminal
```

No production UI control is added for this test. Connected-browser automation
may call the existing route from the authenticated page context. The existing
route constructs its prompt server-side; acceptance never supplies, reads,
copies, or records that prompt. A tested page-context-only helper performs
exactly one fetch, aborts at 35 monotonic seconds, drains and discards response
bytes, never retries an uncertain result, and returns only safe timestamps,
success, and a closed status class.

The AI observer uses two concurrent tail jobs in one read-only observer run.
The controller learns first-terminal presence only from the signal job's
allowlisted completion state and timestamp, never its logs. The uniqueness job
remains active through `expiresAt + 3 minutes` and releases the single terminal
only after that dynamic window closes. The existing 65-minute job timeout is an
absolute failure ceiling, not the normal close time.

A missed evidence instant, late scheduled delivery, late request completion,
expiry, duplicate terminal, or mixed terminal makes the attempt inconclusive.
Never retry an uncertain request.

### 5. Permanent-maintenance evidence placement

Permanent maintenance receives an exact baseline slot:

1. complete local Gate 0 using the explicit preview Cloudflare build
   environment;
2. deploy the exact reviewed normal artifact;
3. prove unauthenticated health, signed-in diagnostics and calendar reads,
   exactly the two permanent schedules, and no temporary binding;
4. select the next quarter-hour tick as canonical `maintenanceScheduledAt`,
   then start a `calendar_maintenance` observer so its listener is active before
   that exact tick;
5. hold uniqueness through `maintenanceScheduledAt + 120 seconds` and accept
   exactly one fixed-shape terminal carrying that exact scheduled event before
   any other temporary candidate; earlier, later, or timestamp-missing events
   fail closed.

Permanent maintenance telemetry advances to
`vision.calendar-maintenance/v2`. Its only new field is canonical UTC
`maintenanceScheduledAt`, derived inside the Worker from the admitted
`ScheduledController.scheduledTime` passed to the maintenance job. It is never
inferred from log arrival time or an unvalidated tail envelope. V1, wrong-key,
extra-key, malformed, or noncanonical timestamps fail closed.

Every later candidate has its own observer. Every rollback must restore the
reviewed normal artifact, obtain fresh signed-in reads, and run the separate
closure operation before another candidate begins. Ordinary candidates prove
strict normal provider state. The ordered role/restore pair proves only its
exact scoped binding profile until both temporary names are deleted and strict
normal cleanup is proved; it may admit no unrelated candidate in between. The
repair test obtains an additional maintenance record at its calculated eligible
tick.

### 6. Immutable observer attribution

The immutable historical role-probe/restore workflow cannot gain the current
candidate-side observer checks. Add temporary role-probe and fenced-restore
operations to the reviewed current preview workflow, reusing their existing
runtime modules plus the current observer-first, candidate re-resolution,
rollback, and closure gates. Never dispatch the historical three-input
workflow.

The current preview workflow stays below GitHub's ten-input limit. It exposes
exactly `acceptance_operation`, `acceptance_context`, and
`configure_ai_budget`. The context is bounded canonical ASCII JSON with a
versioned `kind` equal to the selected operation, exact keys per discriminated
variant, no extras, and byte-for-byte canonical reserialization. It consolidates
fault/evidence selectors, lifecycle references, authenticated-read/AI/restore
attestations, observer dispatch timestamps, the exact maintenance scheduled
instant, and AI scheduled/expiry instants.
Every variant begins, in order, with `version`, `kind`, and `reviewedCommit`;
the commit is the lowercase 40-hex frozen candidate. Candidate variants then
use the exact ordered base keys `authenticatedReadsGate`, `candidateRunRef`,
`rollbackClosureRunRef`, `observerDispatchStartedAt`, and
`observerDispatchCompletedAt`, followed only by their closed fault, AI, or
restore-specific keys. Rollback, closure, cleanup, observe, and none variants
have their own exact ordered key sets. Only fault observe carries
`faultScenario`; only the two maintenance observe outcomes carry canonical
`maintenanceScheduledAt`; only AI observe/deploy carries its scheduled/expiry
pair; and only `deploy_ai` or `deploy_restore` carries its corresponding
verified gate. All other variants reject those keys.

One canonical serializer creates a new plain object in the normative field
order and emits ASCII-only whitespace-free JSON. Parsing rejects more than
2,048 bytes, non-ASCII, duplicate/extra/reordered keys, invalid timestamp/ref/
commit grammar, wrong presence rules, or any byte sequence that differs from
canonical reserialization. The numeric observer handle and restore-pair binding
profile never enter it.
The workflow reads the context from a step environment variable and never
shell-interpolates or echoes it.

Before each branch-based dispatch, the controller resolves the allowlisted
remote tip and requires it to equal `reviewedCommit`. Every current observer
and candidate then verifies `head_sha`, `github.sha`, and checkout `HEAD`
against that exact value before credentials or provider access. A branch move
between tip resolution and dispatch therefore fails inside the run rather than
deploying an unreviewed commit.
Pending restore remains single-attempt and replay-fenced; migrating its
admission path does not authorize a retry.

Only the current `deploy_restore` operation accepts a closed
`restoreAdmissionGate=verified` context attestation after private
disposable-target,
marker, and single-attempt checks. The attestation is workflow admission only,
never a Worker binding or substitute for the runtime replay fence.
Immediately before dispatch, the controller repeats those three checks against
current provider and local evidence state and derives the verified gate only
from that fresh action-time result. Any ambiguity stops without dispatch and
retains both the disposable branch and replay marker.

The unchanged normal provider-state validator continues requiring the exact
normal binding inventory and is used for baseline, every non-role/restore
candidate, final cleanup, and permanent operation. A separate closed
restore-pair validator is selected only from validated role/restore lifecycle
artifacts. It accepts the exact normal inventory plus exactly the
`PREVIEW_RESTORE_DATABASE_URL` and `PREVIEW_RESTORE_TARGET_ID` `secret_text`
names, rejects every other addition or type, and never reads their values.
Role/restore candidate predeploy, rollback, and closure use that scoped
profile. A role closure unlocks only the same-commit restore or cleanup; a
restore closure unlocks only cleanup. After action-approved deletion of both
names, the existing cleanup operation must prove their absence with the
unchanged strict normal validator before any other candidate or source cleanup.
During live Task 8, name-only creation/deletion facts remain only in ignored
local evidence. Task 10 later transfers the reviewed privacy-safe facts into
the tracked credential log.

Suppression and replay-fenced restore observer runs have a fast, output-free
signal job plus a separate 120-second uniqueness job. Foundation, fault, and
role-probe candidates retain one first-terminal signal job and intentionally
make no duplicate claim: their one-minute candidate can emit again while
rollback rebuild/deploy is still running. The controller dispatches rollback
from allowlisted signal-listener step metadata, never job logs. Permanent
maintenance needs only its bounded uniqueness job, is bound to canonical
`maintenanceScheduledAt`, rejects any terminal from another scheduled instant,
and closes at that instant plus 120 seconds. AI has its separate dynamic
uniqueness window.

Signal jobs exit nonzero on no match, malformed input, premature end-of-stream,
or upstream failure. Every uniqueness job succeeds only with exactly one
terminal at its true close; zero, duplicate, mixed, malformed, premature EOF,
or upstream failure exits nonzero without a fallback record.

Structural classification is not acceptance success. The canonical observe
context carries a closed expected outcome: foundation/role/restore/AI must
succeed, maintenance must succeed and the repair gate specifically requires
`repairOutcome=reserved`, each fault must match its requested scenario and
deterministic expected state, and suppression must be exactly `suppressed`.
Canonical failure or wrong-scenario records therefore fail the observer job
instead of producing false-positive acceptance.

Signal time is the exact allowlisted listener step's `completed_at`, accepted
only with successful containing-job state; later post-steps cannot extend the
clock. The controller dispatches rollback within 50 monotonic seconds of local
detection and within 59 seconds of that provider timestamp, conservatively
proving the 60-real-second bound under one-second timestamp precision. For
non-AI candidates with a user-mediated action, reaching `expiry - 180 seconds`
without beginning the approved action triggers idle rollback. After
provider-confirmed action completion, no signal by
`min(action completion + 120 seconds, expiry - 60 seconds)` triggers immediate
rollback and a failed attempt; scheduled candidates use deploy completion as
action completion. Suppression/restore uniqueness may finish after rollback
dispatch, but the candidate is never left deployed while waiting.

Observer-run resolution uses a reviewed local resolver:

1. capture UTC timestamps immediately before and after dispatch;
2. poll every five seconds to a monotonic 120-second deadline, querying only the
   expected workflow, `workflow_dispatch` event, immutable head commit, and
   closed timestamp interval;
3. fail immediately if more than one candidate matches, and at the deadline
   require exactly one candidate run;
4. at the same deadline require its exact family-specific observer job set and
   one allowlisted listener step per job to be `in_progress`; suppression and
   restore require signal plus uniqueness, foundation/fault/role-probe require
   one signal job, AI requires its dynamic signal plus uniqueness jobs, and
   permanent maintenance uses only its uniqueness job carrying the exact
   canonical `maintenanceScheduledAt`;
5. keep the numeric run identifier in process memory only;
6. never print the identifier, full run response, link, or raw job log.

Zero final matches, multiple matches at any poll, timeout, or any non-allowlisted
response fails closed. The candidate workflow independently revalidates the
run, job set, listener steps, evidence family, head commit, and state both
before preparation and immediately before deployment. The numeric identifier
is never a workflow input. Candidate dispatch persists only the safe closed
observer-dispatch timestamp interval; the candidate job independently runs the
same bounded resolver against that interval and its immutable `github.sha`,
keeping its resolved identifier only inside that job process.

Because GitHub dispatch accepts a branch or tag rather than a raw commit, the
controller uses only the allowlisted reviewed Phase B branch and resolves its
remote tip immediately before every observer, candidate, rollback, closure, or
cleanup dispatch. It compares that tip in memory with the exact frozen commit
carried as `reviewedCommit` in the canonical context and exposes only a boolean
match result. Every remote tip query and push uses an argument-array adapter
that captures and discards both child streams, validates exit status and the
exact one-line canonical 40-hex result internally, and emits only a closed
Boolean or constant safe error. No remote URL or command argument can reach
output even on failure. Any movement fails closed. Each dispatched run
independently requires `github.sha`, run `head_sha`, and checkout equality with
that value before credentials or provider access.

### 7. Pushed-commit evidence

The final pre-acceptance candidate commit is independently reviewed and pushed
before any dispatch. Local and remote equality is proved with boolean-only
output from the privacy-safe remote adapter; direct remote Git output is never
inherited or printed. The prerequisite authoring push uses the same process
boundary before the permanent adapter exists.

The exact candidate commit may be recorded later in the tracked post-acceptance
evidence commit because that later commit is not the candidate it identifies.
During live execution, the value remains only in ignored local evidence and
immutable workflow artifacts. This avoids a self-referential commit while
retaining reproducibility.

## Restore-marker and provider-cleanup order

The opaque restore-attempt marker is a replay fence. Retain it through:

1. the fenced restore;
2. every rollback and closure;
3. all remaining live candidates;
4. Task 9 source and workflow cleanup;
5. independent cleanup review;
6. push of the exact reviewed cleanup commit, then current-workflow checkout,
   invocation of the permanent tested normal-preview runner, guarded dispatch
   carrying that commit, exact `head_sha` / `github.sha` / checkout equality,
   preview rebuild, validation, deployment, and fixed-schema deployed-commit
   attribution from that same immutable commit;
7. fresh normal health, signed-in reads, two-schedule proof, and proof that all
   temporary bindings and Worker secrets are absent.

Only then may the owner delete the disposable Neon branch through signed-in
provider controls with action-time confirmation. Immediately before that
approval, re-prove only the safe boolean that the replay fence still exists.
Verify only that the branch count decreased by one and the privately selected
disposable target is absent. If the marker is missing or deletion/verification
is uncertain, retain all remaining state and stop.

After the branch absence is proved, the owner may use signed-in R2 controls with
separate action-time confirmation to delete the sole opaque replay marker
without returning its object key. Delete the marker last. The protected backup
prefix and key remain untouched.

Before provider cleanup is complete, enumerate only preview Worker secret names
and, with action-time approval, delete any remaining
`PREVIEW_RESTORE_DATABASE_URL` and `PREVIEW_RESTORE_TARGET_ID` names without
reading their values. Permanent secrets and backup key version `1` remain
unchanged.

Deleting the marker immediately after the fenced restore is rejected because a
delayed historical invocation could replay before temporary code is removed.
Retaining it forever is also rejected because it leaves an unnecessary
acceptance artifact after replay is impossible.

## Failure handling

- Any uncertain observer, candidate, terminal, rollback, closure, or provider
  state stops admission of later candidates and Task 9.
- Candidate failure or uncertainty triggers immediate normal rollback.
- No destructive provider cleanup occurs until normal rollback and post-restore
  signed-in reads are proved.
- The fenced restore remains single-attempt. A failed or uncertain restore is
  never retried automatically; retain its marker and disposable branch.
- Missing, duplicate, malformed, mixed, late, or misattributed evidence fails
  closed.
- Evidence contains only allowlisted categories, booleans, counts, durations,
  and UTC timestamps. It never contains event content, prompts, responses,
  account data, provider identifiers, object keys, request bodies, credentials,
  authorization values, or URLs.

## Test-first implementation

Implementation begins with failing tests for:

1. the closed `deploy_sync_suppression` workflow operation, matching observer,
   normal schedules, ten-minute bound, and mutually exclusive selectors;
2. suppression of only a fully verified `exists` notification after every
   existing authenticity and replay check;
3. absence of durable job reservation and Queue send only in the active
   suppression branch;
4. exact suppression evidence shape, extra-key rejection, mixed-terminal
   rejection, and raw-line non-retention;
5. zero-active admission, exact `settled` eligibility, pre-activation and
   boundary exclusions, `settled_estimate` rejection, count `0` waiting, count
   `1` terminal, multiple-count failure, and month-boundary rejection;
6. no AI evidence reads outside `evidenceScheduledAt`, no status or calendar
   reads before the request gate opens, no reads on the following tick,
   exact-tick expiry rejection, and duplicate same-timestamp terminal
   detection;
7. strict quarter-hour repair eligibility, exact-boundary behavior, safe-anchor
   changes, canonical `maintenanceScheduledAt` binding, rejection of
   earlier/later/missing scheduled events, the exact 120-second close, and the
   following-tick repair deadline;
8. approval expiry, remaining-lifetime margins, and request/terminal ordering;
9. current-workflow role/restore migration, immutable candidate attribution,
   operation-scoped provider bindings, narrow restore runtime capability, and
   privacy-safe bounded observer-run polling;
10. path-scoped proof that new acceptance surfaces have no R2 deletion
    capability and that only the two approved permanent deletion paths remain;
11. disposable-branch-before-marker cleanup ordering, the revised Task 9
    inventory, and intentional pre-cleanup RED state;
12. the exact three-input workflow schema, canonical context parsing, remote-ref
    movement rejection, family-specific job sets, and acceptance-outcome-aware
    signal/uniqueness exits;
13. the exhaustive four-disposition Task 1-8 path manifest, exact-path cached
    cleanup review, and the post-cleanup guarded normal-deploy input/artifact;
14. the permanent remote-Git adapter's exact one-line tip parsing,
    expected-parent/expected-commit push binding, full child-output discard,
    URL-bearing failure privacy, and Boolean-only result.

After targeted GREEN tests, run the full typecheck, unit/integration/security,
contract, Worker, documentation, preview build and validator, production build,
release-security, browser E2E, and cleanup-contract gates. Obtain an independent
exact-diff review with zero Critical and zero Important findings before pushing
the live candidate.

## Task 9 cleanup

Task 9 removes every temporary source, test, workflow input, binding, selector,
evidence family, resolver, timing helper, documentation instruction, and
reference page introduced for acceptance.

It retains:

- permanent authentication and owner scoping;
- normal Google webhook, Queue, sync, renewal, and repair behavior;
- aggregate AI accounting and hard-stop enforcement;
- permanent value-free maintenance telemetry and bounded ordinary observation;
- normal backup, restore, import, and offline recovery tooling;
- the two normal schedules;
- one permanent normal preview deployment path guarded by a required canonical
  reviewed-commit input and a fixed privacy-safe attribution artifact;
- one permanent tested local runner that compares the allowlisted remote tip
  in memory, resolves exactly one bounded normal-deploy run, verifies its
  immutable head, and validates that exact attribution artifact without
  depending on temporary acceptance orchestration;
- one permanent tested safe-Git adapter that owns exact-tip queries and pushes,
  captures and discards child stdout/stderr, validates canonical results
  internally, and exposes only closed booleans or constant errors;
- the approved 30-day backup retention and failed-verification cleanup;
- backup key version `1`.

Before Task 7, one literal exhaustive Task 1-8 path map classifies every source,
test, workflow, active-operations document, and simple/technical reference as
dedicated deletion, shared unwind, permanent retention, or historical
retention. Task 9 stages only the exact changed-path projection of that reviewed
map, proves the cached path set, and obtains independent review of that cached
tree before commit and push.

The strict cleanup contract must turn GREEN before cleanup review and
deployment. Its R2 capability assertion must still identify exactly the two
approved permanent deletion paths and zero temporary acceptance deletion paths.
The surviving workflow removes all acceptance inputs/jobs and retains only a
required canonical lowercase 40-hex `reviewed_preview_commit` input for normal
deployment. Before credentials or provider mutation it requires run head,
`github.sha`, and checkout equality, builds and deploys only that checkout, and
emits one exact `preview-normal-deploy-attribution-v1` artifact containing only
version, success outcome, reviewed commit, and canonical start/completion
timestamps.
The Phase C handoff skeleton is created and classified as a retained top-level
operations document before that review. Post-acceptance work may fill only its
reviewed privacy-safe fields, then reruns documentation, security, and cleanup
contracts; no new unclassified operations path is created afterward.

## Alternatives rejected

### Stop a Google channel, route, or Queue directly

This is broader than one verified notification, can affect unrelated edits, and
is difficult to attribute and reverse. The bounded post-authenticity suppression
seam is safer.

### Use synthetic repair evidence only

Unit and integration tests are necessary but do not prove the deployed
end-to-end repair path. Live acceptance still requires one controlled missed
signal.

### Race the next one-minute AI schedule

Operator timing cannot guarantee the separately approved request precedes the
terminal. Gating on one completed ledger lifecycle provides causal evidence.

### Emit AI evidence directly from the HTTP response

This couples acceptance logging to request latency and changes the production
route and evidence architecture more than necessary.

### Add durable suppression state

A database, KV, or Durable Object arm could make suppression exactly once, but
adds schema, binding, concurrency, and cleanup surfaces. A single-user bounded
window plus immediate rollback is sufficient for this acceptance.

### Delete the restore marker before the disposable branch

This weakens the replay fence while a delayed historical invocation may already
hold credentials for the disposable branch. The branch is deleted first after
post-cleanup normal proof; the marker is the final provider artifact removed.

### Make the backup prohibition literal for permanent recovery

This would retain independently failed and expired backup objects forever,
contradict the approved retention design, and increase storage risk. The owner
approved the acceptance-scoped interpretation instead.
