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
- GET discovery, explicit stable-ID selection, and exact confirmed creation routes.
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
