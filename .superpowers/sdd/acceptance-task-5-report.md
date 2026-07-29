# Acceptance Instrumentation Task 5 Report

## Scope

Implemented the six preview-only fault scenarios from Task 5 on
`codex/phase-b-foundation` from base `523d79b` without a migration, a public
operator route, provider event-write capability, secrets, or R2 deletion.

## RED evidence

1. `pnpm.cmd test:unit tests/unit/domain/temporary-preview-fault.test.ts`
   initially failed because the new domain module did not exist.
2. `pnpm.cmd test:worker tests/worker/diagnostics.test.ts` failed the five
   new authenticated overlay expectations before the route applied overlays.
3. `pnpm.cmd test:unit tests/integration/jobs/temporary-preview-fault.test.ts`
   initially failed because the temporary job module did not exist.
4. `pnpm.cmd test:unit tests/integration/jobs/daily-backup.test.ts` failed the
   injected-writer assertion while backup creation still called the store's
   writer directly.
5. `pnpm.cmd test:unit tests/unit/scripts/safe-tail-classifier.test.ts` failed
   the new fault evidence and duplicate/mixed record expectations before the
   safe-tail classifier admitted the schema.
6. `pnpm.cmd test:unit tests/unit/scripts/print-safe-tail.test.ts` rejected
   the new `--preview-fault-only` mode before the printer accepted it.

The brief's literal `pnpm.cmd exec vitest` form was unavailable in this Windows
worktree; the declared `pnpm.cmd test:unit` / `test:worker` scripts ran the
same focused projects. The recurrence is recorded in the setback ledger.

## GREEN evidence

- Domain parser accepts only the frozen six values from a generated preview
  binding; absent binding is normal, while malformed, unknown, multiple, and
  production bindings reject.
- Authenticated diagnostics now apply copy-on-write overlays only after session
  and owner admission. Unauthenticated requests do not read foundation facts.
- The `r2_upload_failed` candidate replaces only `BackupObjectWriter` with a
  constant rejecting writer. `createDailyBackup` therefore reaches no real R2
  `put` through that seam; it preserves the fixed storage-write failure and
  leaves existing objects untouched.
- `vision.preview-fault/v1` is an exact four-key closed record. Only
  `r2_upload_failed` maps to `failed/backup_storage_write_failed`; every other
  scenario maps to `succeeded/none` under `acceptance.preview-fault`.
- Safe-tail reconstruction rejects wrong matrices, duplicate terminal records,
  mixed foundation/AI/maintenance terminals, extra keys, and wrong actions.

## Fresh gates

| Command | Result |
| --- | --- |
| `pnpm.cmd typecheck` | pass |
| focused domain/backup/fault/safe-tail/printer unit command | 90 passed |
| `pnpm.cmd docs:check` | pass |
| `pnpm.cmd test:worker` | 83 passed |
| `pnpm.cmd test:e2e` | 29 passed |

Worker tests emitted the pre-existing managed-sandbox static export-analysis
warning, but exited zero. Task-local `XDG_CONFIG_HOME` prevented the optional
Wrangler user-profile log-write failure.

## Self-review

- Preview binding is server-only and never read from route input, query,
  headers, cookies, body, Queue payload, database state, or model output.
- Overlay selection precedes repository access only for generated binding
  validation; application of facts remains after session and owner admission.
- The R2 fault writer rejects before the real store writer and no code deletes
  `backups/v1/`.
- Normal diagnostics and normal two-cron configuration remain unchanged when
  the temporary binding and one-minute cron are absent.
- Fault evidence is isolated from foundation-probe and AI-usage evidence by the
  safe-tail terminal registry.
- No migration files changed and no secret-bearing value was added or printed.

## Review-fix addendum

The Critical, Important, and Minor findings in
`acceptance-task-5-review.md` were corrected from reviewed commit `1880cf9`.
The six admitted scenarios and the exact four-key
`vision.preview-fault/v1` evidence record remain unchanged.

### Additional RED evidence

1. Focused backup and fault-job tests initially reported 12 failures because
   the R2 terminal was emitted before proving the injected writer was reached,
   upstream backup errors were relabeled, and the real scheduled entry point
   did not expose the required injected boundaries.
2. The actual-candidate Worker test failed because `ai_stopped` still
   constructed the budgeted provider.
3. The client-boundary test reported seven failures because the runtime binding
   and each of the six admitted values were not yet rejected from the built
   client.
4. A focused backup privacy test failed until the writer cause was retained in
   a class-private, non-enumerable field.

All failures were observed before their corresponding production changes and
then rerun green.

### Corrections

- The paid category-proposal route now admits the server-only preview binding
  after authentication, CSRF, and strict input validation but before budget
  reservation, owner-context loading, provider construction, Gateway dispatch,
  or provider I/O. `ai_stopped` returns the existing safe budget-stop response;
  malformed configuration returns the constant safe unavailable response.
- The real one-minute `scheduled()` entry point dispatches all six fault
  scenarios through injected R2/evidence boundaries. Missing, malformed, and
  production candidates fail closed and cannot fall through to role,
  foundation, AI, maintenance, recovery, Google, Queue, or database
  capabilities. The explicit preview role-probe candidate remains separate.
- The R2 scenario emits its terminal only when the constant injected writer
  failure is found through the private causal wrapper. Existing valid daily
  objects still exercise the R2 read path but perform no write or terminal;
  snapshot/upstream failures and an ignored writer propagate without false
  R2 evidence.
- `PREVIEW_ACCEPTANCE_SCENARIO` is classified as a client-forbidden runtime
  binding, and each admitted scenario literal is rejected if it appears in the
  built client.
- Worker tests now prove route, query, header, cookie, body, Queue message,
  database row, and model output cannot activate a candidate. Wrong-owner
  ordering, the actual `ai_stopped` paid-route boundary, exact public response
  shapes, R2 read continuity, and all six real scheduler dispatches are also
  covered.
- Task 5 browser tests now bridge the page to the injected Worker application
  and render all six scenarios with calendar reads intact, no write controls,
  and zero paid AI work.
- The simple and technical safe-tail references again document exact cron
  mapping, terminal precedence, fallback blocking, key counts, framing reset,
  and first-message versus all-message traversal.

### Final fresh gates

| Command | Result |
| --- | --- |
| `pnpm.cmd check` | pass: typecheck; 962 unit/integration passed, 1 skipped; 179 contract passed; 94 Worker passed; docs, build, release evidence, and security scan passed |
| `pnpm.cmd test:e2e` | pass: 35 Chromium tests |
| focused Worker diagnostics | pass: 29 tests |
| focused client boundary | pass: 34 tests |
| focused R2/scheduler/domain coverage | pass: 49 tests |

The Worker suite still emits the known managed-sandbox static export-analysis
warning and exits zero. Wrangler diagnostics were routed to a task-local
directory. A generated untracked `debug.log` was contained, recorded, and
removed before staging. No live provider, external resource, secret value, or
private identifier was used.
