# Connected Checkpoint Lag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent ordinary sync progress from blocking sign-in for an already-connected, unmarked calendar.

**Architecture:** Add one guarded alternative to the existing locked maintenance/checkpoint join. Reuse the unchanged closed outcome classification, callback, diagnostics, and atomic update guards; the new case makes no database changes.

**Tech Stack:** TypeScript, Drizzle SQL, PostgreSQL/PGlite, Vitest, Cloudflare Workers, GitHub Actions.

Hardline: **no more than 20 agents at once**. Execute the tightly coupled test/fix loop inline; use one independent review agent.

---

### Task 1: Baseline and RED

Files: `tests/integration/jobs/sync-repository.test.ts`,
`tests/integration/jobs/channel-maintenance-adversarial.test.ts`.

- [x] Confirm isolated `codex/phase-c-oauth-preview-fix` at `bda31fc`, preserve existing incident edits, and run both current test files: 55 tests passed.
- [x] Add a normal-sync regression using existing `run`, `client`, and `repository` helpers. Seed canonical setup, connection, and synthetic token metadata; bootstrap maintenance; run two empty successful syncs. After each sync require `not_needed` and compare complete checkpoint/maintenance/token/setup/connection snapshots before and after recovery.

```ts
await expect(maintenance.recoverAuthorizationAfterReconnect({
  googleSubject: "subject-1",
  tokenVersion: 2,
  tokenUpdatedAt: new Date("2026-07-24T16:00:00.000Z"),
})).resolves.toBe("not_needed");
```

- [x] Add a connected/unmarked lag fixture and table-driven guards: equal and older versions allow `not_needed`; newer maintenance, marked checkpoint, missing maintenance/connection/checkpoint, subject/calendar/setup mismatch, changed token metadata, and disconnected/retry/action-required states still conflict. Assert no mutation, including active lease/counters, and repeated calls.
- [x] Run `pnpm exec vitest run --project unit tests/integration/jobs/sync-repository.test.ts tests/integration/jobs/channel-maintenance-adversarial.test.ts`; require the new positive lag cases to fail with received `conflict`, not a setup/runtime error.

### Task 2: Minimal GREEN and SQL contract

Files: `src/data/repositories/channel-maintenance-repository.ts`,
`tests/contract/google/oauth.contract.test.ts`.

- [x] Replace only the topology join's checkpoint-version equality with:

```sql
and (
  maintenance.checkpoint_version = checkpoint.version
  or (
    maintenance.checkpoint_version < checkpoint.version
    and checkpoint.status = 'connected'
    and maintenance.credential_failure_checkpoint_version is null
    and maintenance.credential_failure_category is null
    and maintenance.credential_failure_recorded_at is null
  )
)
```

- [x] Extend the parameterized one-statement contract to assert this whole guarded alternative; preserve row-lock, exact-token, atomicity, and privacy assertions.
- [x] Re-run the two integration files, contract file, Worker auth file, and `pnpm typecheck`. All must pass; disconnected recovery mismatch tests remain unchanged.

### Task 3: Documentation, review, and full verification

Files: matching simple/technical `docs/reference/*/src/data/repositories/channel-maintenance-repository.md`,
`docs/superpowers/specs/2026-08-02-oauth-reconnect-authorization-recovery-design.md`,
and the existing callback recovery incident and index.

- [x] Document the new no-mutation exception in both references and link the approved amendment from the original design.
- [x] Independent read-only review against the approved design, including SQL precedence, every retained guard, and test coverage. Resolve all critical/important findings. Verdict: no critical or important findings; ready for preview.
- [x] Run `pnpm check`, `pnpm test:e2e`, preview build with `CLOUDFLARE_ENV=preview`, and `pnpm deploy:check:preview`. Unset that environment override, then dry-run Wrangler against `dist/vision/wrangler.json`. Record unavailable live PostgreSQL interleaving evidence separately.
- [ ] Run `git diff --check`, inspect exact staged paths, and commit the approved repair and evidence. Do not stage ignored scratch SQL or secrets.

### Task 4: Preview release and owner acceptance

- [ ] Fast-forward push to `origin/codex/phase-c-write-pipeline`; do not change main or production.
- [ ] Dispatch `preview.yml` with operation `none`, budget configuration `false`, reviewed full commit SHA, and validated canonical version-2 acceptance context. Use the exact returned run ID; do not repeat dispatch.
- [ ] Verify GitHub admission, candidate verification, and deploy jobs all succeed for that SHA. Preserve existing secrets, queues, schedules, and the diagnostic.
- [ ] Check live health 200, unauthenticated session 401, and OAuth start 302 without exposing cookies or redirect query values. Owner then completes Google sign-in; record only success or the safe diagnostic stage. Keep live acceptance pending until that result arrives.
