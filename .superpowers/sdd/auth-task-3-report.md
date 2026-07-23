# Authentication/Calendar Setup Task 3 Report

## Status

Implemented and verified on `codex/phase-b-foundation`.

## RED to GREEN evidence

- Calendar adapter RED: `calendar-client.ts` was absent; Vitest failed module resolution.
- Calendar adapter GREEN: 5 contract tests passed.
- Calendar repository RED: `calendar-repository.ts` was absent; Vitest failed module resolution.
- Calendar repository GREEN: 4 executable PGlite tests passed.
- Calendar routes RED: the three setup endpoints returned the existing 404 fallback.
- Calendar routes GREEN: 8 Worker tests passed.
- Late-candidate race RED: confirmation returned 200/created when an owned candidate appeared after discovery.
- Late-candidate race GREEN: confirmation now returns 409 `awaiting_choice` and performs zero creates.

## Implemented contracts

- Bounded CalendarList pagination and hostile-response validation.
- Candidate rule: exact `Vision`, `owner`, non-primary, non-deleted, stable nonempty ID, and evidence bound to the verified Google subject.
- Calendars insert body is exactly `{summary: "Vision", timeZone: userTimeZone}`.
- Read-only GET snapshot plus CSRF-protected discovery, explicit stable-ID selection, and exact confirmed creation routes.
- Authenticated server session and CSRF enforcement for POST.
- Exact current setup-version compare-and-swap.
- Atomic local idempotency ledger and normalized pre-create owned-ID snapshot before provider mutation.
- One unresolved create per owner; repeated/concurrent keys cannot cause a second provider create.
- Uncertain response reconciliation by set difference: one completes, zero remains retryable, many becomes Action required.
- Persisted stable ID, account ownership evidence, timezone, provider ETag, verification timestamp, connection kind, and operation result.
- No Google event insert/update/delete method or endpoint in the setup adapter or route mock surface.
- Safe generic API errors and fixed-shape audit facts without tokens, IDs, operation keys, or provider bodies.
- Mirrored simple/technical file and folder documentation plus JSDoc for every production function.

## Verification evidence

### Focused

Command:

```powershell
.\node_modules\.bin\vitest.CMD run tests/contract/google/calendar-setup.contract.test.ts tests/integration/data/calendar-repository-concurrency.test.ts tests/worker/calendar-setup.test.ts
```

Result: 3 files passed, 17 tests passed.

Production and test TypeScript compilers passed. Documentation coverage passed.

### Full gate

Command:

```powershell
$env:XDG_CONFIG_HOME=(Resolve-Path '.wrangler').Path
pnpm.cmd check
```

Result:

- Unit/integration: 29 files passed, 183 tests passed.
- Worker: 4 files passed, 23 tests passed.
- Documentation coverage: passed.
- Production and client builds: passed.
- Production crypto boundary validator: passed.

### Static scans

- `git diff --check`: passed.
- Calendar setup source event-write endpoint/method scan: passed with zero matches.
- Production/docs/migrations token/client-secret sentinel scan: passed with zero matches.
- PGlite raw-row test confirmed stable metadata only and no token/provider/event payload plaintext.

## Review notes

- No live Google, Neon, Cloudflare, or other external service was used.
- Worker tests emit a known Cloudflare static-analysis warning caused by the sandbox denying traversal above the worktree. The suites and production build still pass; this is not an application failure.
- A current access token is required. Refresh is intentionally not added in this task; an absent/expired token returns the generic setup-unavailable response.

## Consolidated I1-I4 correction evidence

### I3 provider deadline and streamed-body RED to GREEN

- RED: newly added never-resolving header and body tests hit Vitest's 5,000 ms timeout because production had no deadline.
- GREEN: 8 adapter contract tests pass in under one second.
- One configurable deadline, capped at 30 seconds, now covers fetch headers and every streamed body read.
- AbortController is passed to fetch; the timer is always cleared.
- Response bytes are read incrementally with a one-megabyte production ceiling and 4,096-chunk ceiling. Overflow cancels the reader before accumulation.
- No production `response.text()` or `response.json()` call exists.
- List/get aborts, timeouts, malformed bodies, and overflow are definite non-mutation failures. Insert aborts/timeouts/5xx or successful-response body uncertainty are `uncertain`; insert 4xx/429 is `definite_failure`.

### I2 and I4 discovery RED to GREEN

- RED: cookie-only GET still returned mutated version 3 state; `POST /api/setup/calendar/discover` returned 404; the repository had no `discover` method.
- GREEN: GET performs one owner-scoped read and returns immutable virtual version 1 state when no row exists.
- Discovery is now only `POST /api/setup/calendar/discover`, requiring active session, exact CSRF, strict `{setupVersion}` input, and provider listing before persistence.
- One parameterized statement inserts or CASes the prior owner/subject/version/status directly into `awaiting_choice` or `awaiting_confirmation`, clears candidates, and inserts only the winner's result. No production statement writes durable `discovering`.
- Concurrent PGlite discovery returns the authoritative winner to both callers; stale provider results cannot overwrite.
- Injected missing/expired token, provider-list failure, and result-persistence failure leave setup unchanged.
- Worker coverage includes cookie-only read-only GET plus missing, wrong, and correct discovery CSRF.

### I1 definite and uncertain creation RED to GREEN

- RED: a definite create rejection entered reconciliation and reserved `retryable`; there was no terminal repository method.
- GREEN: 4xx/429 adapter outcomes remain definite; route reconciliation is limited to uncertain insert outcomes or failures after a successful insert response.
- Atomic `definite_failure` terminalization completes the ledger, advances setup to failed/action-required, and releases the partial unresolved-operation uniqueness claim.
- Corrected recovery requires a fresh discovery version, exact confirmation phrase, and new UUID key.
- `retryable` remains in the unresolved partial index, cannot rediscover to a new confirmation path, and is reconciliation-only.
- Post-insert CalendarList verification and atomic completion failures reconcile by the durable pre-create ID snapshot without another insert.

### Corrected verification

Focused command:

```powershell
.\node_modules\.bin\vitest.CMD run tests/contract/google/calendar-setup.contract.test.ts tests/integration/data/calendar-repository-concurrency.test.ts tests/worker/calendar-setup.test.ts
```

Result: 3 files passed, 27 tests passed.

Full command:

```powershell
$env:XDG_CONFIG_HOME=(Resolve-Path '.wrangler').Path
pnpm.cmd check
```

Result:

- Unit/integration: 29 files passed, 186 tests passed.
- Worker: 4 files passed, 27 tests passed.
- Production and test TypeScript: passed.
- Mirrored documentation coverage: passed.
- Worker and client production builds: passed.
- Production crypto-boundary validation: passed.

Corrected scans:

- `git diff --check`: passed.
- Event-write endpoint/method scan: zero matches.
- Production/docs/migrations token/client-secret sentinel scan: zero matches.
- Unbounded provider `response.text()`/`response.json()` scan: zero matches.
- Durable `status = 'discovering'` write scan: zero matches.

No live Google, Neon, Cloudflare, or other external service was used in the correction round.
