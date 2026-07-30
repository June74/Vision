# Phase B Live-Acceptance Closure Design

**Status:** Written from the owner-approved design; written-spec review pending

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
replay check and has been classified as an `exists` notification. When active,
it:

1. emits one fixed-shape, content-free suppression record;
2. returns success before durable job reservation;
3. never records headers, event content, calendar identity, channel identity,
   resource identity, message number, account data, or request body.

Invalid, pending-channel, expired, mismatched, replayed, `sync`, and
`not_exists` notifications never enter the suppression branch.

The candidate uses a bounded window rather than durable exact-once state. While
it is active, the controller prohibits unrelated calendar edits and dispatches
rollback within 60 seconds after the first accepted suppression record. If the
selector has expired, the webhook follows the normal durable path; expiry never
extends suppression.

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
2. obtain action-time approval for one disposable event change;
3. record only UTC start and provider-confirmed completion timestamps;
4. poll the authenticated Vision event view every five seconds without copying
   its payload;
5. pass only if the changed version becomes visible within 120 seconds, before
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
6. require exactly one suppression record within 120 seconds;
7. dispatch normal rollback within 60 seconds;
8. complete provider-state proof, signed-in post-restore reads, and the separate
   rollback-closure operation;
9. privately confirm the suppressed version is not yet visible;
10. use the safe last-successful-sync timestamp to calculate the first
   quarter-hour maintenance tick satisfying:

   ```text
   lastSuccessfulSyncAt <= eligibleTick - 15 minutes
   ```

11. start a fresh permanent-maintenance observer before that eligible tick;
12. pass only if the first eligible record reports `repairOutcome=reserved`,
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

Keep the one-minute AI evidence schedule, but give each generated AI candidate
one canonical UTC `evidenceScheduledAt` minute. The handler may read the ledger
or emit evidence only when the scheduled-event timestamp exactly equals
`evidenceScheduledAt` and execution occurs before `expiresAt`. Candidate
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

Add aggregate-only source operations equivalent to:

```text
countActiveRequests()
countEligibleSettledRequests(activatedAt, evidenceScheduledAt)
```

Before candidate generation, `countActiveRequests()` must be zero. The
eligibility operation counts unique reservations created at or after
`activatedAt`, dispatched normally, completed strictly before
`evidenceScheduledAt`, and confirmed in the exact production status `settled`.
It excludes requests created before activation even if they complete later,
requests completing at or after the evidence instant, in-flight requests,
`released` reservations, and conservative `settled_estimate` reservations. The
existing ledger-consistency checks must pass before either count is accepted.
The candidate is rejected if its window can cross the Chicago budget-month
boundary.

At the sole eligible scheduled instant:

- count `0`: return without a terminal or status/calendar evidence reads; the
  live attempt is inconclusive;
- count `1`: run the existing aggregate usage, status, and calendar reads and
  emit one existing `vision.ai-usage/v1` terminal record;
- count greater than `1`: emit the existing closed `inconsistent` failure and
  fail the candidate.

The activation boundary is derived from the existing fixed candidate lifetime
and canonical expiry. The controller freezes every other AI action for this
window.

The live sequence is:

1. prove zero active AI requests, start a fresh `ai_usage` observer, and prove
   its listener active;
2. generate a candidate with one evidence instant far enough in the future for
   deployment, approval, and request completion, then deploy it and verify exact
   attribution;
3. prove no terminal exists, zero active requests still holds, and both
   candidate and observer remain valid beyond the evidence instant;
4. privately select an authorized disposable event and prove the current AI
   tier permits the request;
5. obtain separate approval for exactly one request; that approval expires
   after 60 seconds;
6. immediately reverify the candidate, observer, zero-active baseline, and
   remaining time before the evidence instant;
7. issue one browser-scoped request through the existing authenticated route;
8. retain the session, anti-forgery value, event reference, idempotency key,
   prompt, and response in browser memory only, then drain and discard the
   response body;
9. record only approval, request-start, and request-completion timestamps, a
   success boolean, and a bounded status class;
10. require private confirmation that the one request is exactly `settled`
    before `evidenceScheduledAt`;
11. require exactly one terminal from the sole eligible scheduled instant;
12. immediately dispatch rollback, then complete normal proof, signed-in reads,
    and rollback closure.

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
may call the existing route from the authenticated page context.

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
4. start a `calendar_maintenance` observer before the next quarter-hour tick;
5. accept exactly one fixed-shape maintenance terminal before any legacy or
   temporary candidate.

Every later candidate has its own observer. Every rollback must restore the
reviewed normal artifact, prove normal provider state, obtain fresh signed-in
reads, and run the separate closure operation before another candidate begins.
The repair test obtains an additional maintenance record at its calculated
eligible tick.

### 6. Immutable observer attribution

For a legacy role-probe or fenced-restore workflow, the workflow dispatch ref
and its `ref` input must resolve to the same immutable candidate commit for the
observer and candidate. This is necessary because the historical observer
checkout follows the dispatch commit while the mutation checkout follows the
input commit.

Current observers already check out and verify the dispatch commit before
credentials or provider access. No observer may run from a mutable branch or
tag.

Observer-run resolution uses a reviewed local resolver:

1. capture UTC timestamps immediately before and after dispatch;
2. poll every five seconds to a monotonic 120-second deadline, querying only the
   expected workflow, `workflow_dispatch` event, immutable head commit, and
   closed timestamp interval;
3. fail immediately if more than one candidate matches, and at the deadline
   require exactly one candidate run;
4. at the same deadline require its expected observer job and allowlisted
   listener step to be
   `in_progress`;
5. keep the numeric run identifier in process memory only;
6. never print the identifier, full run response, link, or raw job log.

Zero final matches, multiple matches at any poll, timeout, or any non-allowlisted
response fails closed. The candidate workflow independently revalidates the
run, job, listener step, evidence family, head commit, and state both before
preparation and immediately before deployment.

### 7. Pushed-commit evidence

The final pre-acceptance candidate commit is independently reviewed and pushed
before any dispatch. Local and remote equality is proved with boolean-only
output.

The exact candidate commit may be recorded later in the tracked post-acceptance
evidence commit because that later commit is not the candidate it identifies.
During live execution, the value remains only in ignored local evidence and
immutable workflow artifacts. This avoids a self-referential commit while
retaining reproducibility.

## Restore-marker and provider-cleanup order

The opaque restore-attempt marker is a replay fence. Retain it through:

1. the legacy restore;
2. every rollback and closure;
3. all remaining live candidates;
4. Task 8 source and workflow cleanup;
5. independent cleanup review;
6. deployment of the reviewed normal post-cleanup Worker;
7. fresh normal health, signed-in reads, two-schedule proof, and proof that all
   temporary bindings and Worker secrets are absent.

Only then may the owner delete the disposable Neon branch through signed-in
provider controls with action-time confirmation while the replay fence still
exists. Verify only that the branch count decreased by one and the privately
selected disposable target is absent. If deletion or verification is uncertain,
retain the marker and stop.

After the branch absence is proved, the owner may use signed-in R2 controls with
separate action-time confirmation to delete the sole opaque replay marker
without returning its object key. Delete the marker last. The protected backup
prefix and key remain untouched.

Deleting the marker immediately after the legacy restore is rejected because a
delayed historical invocation could replay before temporary code is removed.
Retaining it forever is also rejected because it leaves an unnecessary
acceptance artifact after replay is impossible.

## Failure handling

- Any uncertain observer, candidate, terminal, rollback, closure, or provider
  state stops admission of later candidates and Task 8.
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
   changes, the 120-second normal threshold, and the following-tick repair
   deadline;
8. approval expiry, remaining-lifetime margins, and request/terminal ordering;
9. immutable legacy observer/candidate ref equality and privacy-safe bounded
   observer-run polling;
10. path-scoped proof that new acceptance surfaces have no R2 deletion
    capability and that only the two approved permanent deletion paths remain;
11. disposable-branch-before-marker cleanup ordering, the revised Task 8
    inventory, and intentional pre-cleanup RED state.

After targeted GREEN tests, run the full typecheck, unit/integration/security,
contract, Worker, documentation, preview build and validator, production build,
release-security, browser E2E, and cleanup-contract gates. Obtain an independent
exact-diff review with zero Critical and zero Important findings before pushing
the live candidate.

## Task 8 cleanup

Task 8 removes every temporary source, test, workflow input, binding, selector,
evidence family, resolver, timing helper, documentation instruction, and
reference page introduced for acceptance.

It retains:

- permanent authentication and owner scoping;
- normal Google webhook, Queue, sync, renewal, and repair behavior;
- aggregate AI accounting and hard-stop enforcement;
- permanent value-free maintenance telemetry and bounded ordinary observation;
- normal backup, restore, import, and offline recovery tooling;
- the two normal schedules;
- the approved 30-day backup retention and failed-verification cleanup;
- backup key version `1`.

The strict cleanup contract must turn GREEN before cleanup review and
deployment. Its R2 capability assertion must still identify exactly the two
approved permanent deletion paths and zero temporary acceptance deletion paths.

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
