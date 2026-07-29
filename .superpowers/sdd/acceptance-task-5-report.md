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
