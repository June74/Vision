# Recovery Conflict Predicate Diagnostic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Identify the precise failed recovery guard in a preview login without changing authorization.

**Architecture:** An optional closed-category observer reads a diagnostic projection from the existing locked SQL statement. Preview alone maps that reason through the existing stage/header/page/logger path.

**Tech Stack:** TypeScript, Drizzle/Neon HTTP, PostgreSQL/PGlite, Hono Workers, Vitest, Playwright.

**Hard line:** no more than 20 agents at once. Worktree:
`C:/Users/2006i/projects/AI calendar (secretary) project/.worktrees/phase-c-oauth-preview-fix`.
Approved scope is diagnostic-only, test-first verification, and exact preview deployment.
Main owns repository changes and release; one delegated worker owns route/diagnostic
changes. Their file sets do not overlap. No secrets, DB resets, migrations, or auth-rule changes.

---

## Task 1: Preserve baseline and lock the contract

- [x] Confirm existing Projects linked worktree and preserve four uncommitted investigation documents.
- [x] Trace the actual registered callback to production recovery adapter.
- [x] Run unchanged focused baseline: 99 repository/logging tests and 45 Worker auth tests passed.
- [x] Record the approved design in `docs/superpowers/specs/2026-09-04-recovery-predicate-diagnostic-design.md`.
- [x] Self-review scope, naming, malformed-input fallback, and full test coverage.

## Task 2: Same-statement repository diagnostic (main)

Files:
- `src/data/repositories/channel-maintenance-repository.ts`
- `tests/integration/jobs/channel-maintenance-adversarial.test.ts`
- both `docs/reference/{simple,technical}/src/data/repositories/channel-maintenance-repository.md`.

- [x] Add table-driven tests to existing real-migration fixtures before implementation.
  For every reason use a valid synthetic fixture, mutate one relevant guard, capture
  all five recovery tables before calling the real repository, and assert equality
  afterward. In particular:
```ts
const reasons: unknown[] = [];
expect(await repository.recoverAuthorizationAfterReconnect({
  googleSubject: "subject-1", tokenVersion: 2, tokenUpdatedAt: RECONNECT_TOKEN_AT,
}, (reason) => { reasons.push(reason); })).toBe("conflict");
expect(reasons).toEqual(["token_timestamp_mismatch"]);
expect(await readRecoveryFacts()).toEqual(before);
```
- [x] Run `pnpm.cmd test:unit tests/integration/jobs/channel-maintenance-adversarial.test.ts`.
  Expect failures because the new observer is not called, not SQL fixture errors.
- [x] Add the literal tuple of reasons from the spec and:
```ts
export type AuthorizationRecoveryConflictReason =
  (typeof AUTHORIZATION_RECOVERY_CONFLICT_REASONS)[number];
export type AuthorizationRecoveryConflictObserver =
  (reason: AuthorizationRecoveryConflictReason) => void;
```
  Add `onConflict?: AuthorizationRecoveryConflictObserver` as the method's second
  parameter. Keep its existing return type/outcome decoder.
- [x] Add only a final SELECT diagnostic projection, leaving existing CTEs unchanged:
```sql
select decision.outcome,
  case
    when decision.outcome <> 'conflict' then null
    when not exists (select 1 from locked_token) then 'token_missing'
    when exists (
      select 1 from locked_token where google_subject is distinct from $subject
    ) then 'token_subject_mismatch'
    when exists (
      select 1 from locked_token where token_version is distinct from $version
    ) then 'token_version_mismatch'
    when exists (
      select 1 from locked_token where updated_at is distinct from $updatedAt
    ) then 'token_timestamp_mismatch'
    else 'unclassified'
  end as conflict_reason
from decision cross join asserted where asserted.ok = 1
```
  Here the named SQL parameters represent the existing Drizzle parameter bindings.
  Expand the CASE with the exact topology/marker guard order in the spec; use only
  existing locked CTEs, null-safe comparisons, and the unchanged version predicate.
- [x] Validate the reason by selecting a literal from the closed tuple. Notify only
  on a valid conflict. Ignore notification exceptions so observations cannot alter
  the returned outcome:
```ts
if (outcome === "conflict" && onConflict !== undefined) {
  const reason = AUTHORIZATION_RECOVERY_CONFLICT_REASONS.find(
    (candidate) => candidate === result.rows[0]?.conflict_reason,
  ) ?? "unclassified";
  try { onConflict(reason); } catch { /* Diagnostics cannot change recovery. */ }
}
return outcome;
```
- [x] Add/verify non-conflict silence, null/malformed fallback, throwing-observer
  preservation, single-statement execution, same-table nonmutation, connected lag,
  exact recovery, other-owner isolation, and simultaneous/newer-token-marker cases.
- [x] Run focused repository tests to GREEN and update both references/JSDoc.

## Task 3: Existing preview diagnostic transport (delegated disjoint worker)

Files:
- `src/server/auth/diagnostics.ts`
- `src/server/auth/oauth-routes.ts`
- `tests/worker/auth.test.ts`
- `tests/unit/server/logging.test.ts`
- `docs/operations/google-oauth-setup.md`
- both references for `src/server/auth/{diagnostics,oauth-routes}.md`.

- [x] Extend actual Worker tests first. The injected recovery port calls its optional
  second-argument observer with a reason and returns conflict. Cover every reason in
  all environments, malicious unknown values, absent observer, accepted outcomes after
  notification, thrown errors after notification, invalid outcomes, no new sessions or
  cookies, old session preservation, unchanged audit category, and private sentinels.
- [x] Run `pnpm.cmd test:worker tests/worker/auth.test.ts`; observe new-stage assertion
  failures before implementation.
- [x] Add authored literals `callback_recovery_<reason>` for all reasons except
  `unclassified` to the existing stage tuple. Add the mapper:
```ts
export function readAuthorizationRecoveryDiagnosticStage(
  reason: unknown,
): AuthDiagnosticStage {
  switch (reason) {
    case "token_missing": return "callback_recovery_token_missing";
    case "token_subject_mismatch": return "callback_recovery_token_subject_mismatch";
    default: return "callback_authorization_recovery_conflict";
  }
}
```
  Expand explicit cases for every non-unclassified reason listed in the spec.
  Return literals only; no concatenation or lookup using untrusted property keys.
- [x] Extend the port with the optional observer type from Task 2. The callback uses
  a request-local stage initialized to generic conflict, passes an observer only
  when `resolved.environment === "preview"`, and emits the captured stage only
  after the final result is exactly conflict. Other result branches stay unchanged.
  Forward the optional observer through the production factory adapter.
- [x] Run Worker/logging tests to GREEN. Preserve logger schema as `z.enum`.
- [x] Add runbook rows including what each category proves and does not prove,
  first-mismatch precedence, privacy boundary, and removal steps. Update mirrored
  references and JSDoc for every new named function.

## Task 4: Integrated review, verification, and exact release (main)

- [x] Read the full diff; confirm the original CTEs/admission predicates, outcomes,
  updates, session ordering, cookies/statuses/audit contract remain unchanged.
- [x] Run independent spec review, then independent code-quality review. Correct
  critical/important findings and re-review before release.
- [x] Run `pnpm.cmd check`, then `pnpm.cmd test:e2e`; require exit zero.
- [x] Build with `CLOUDFLARE_ENV=preview`, run `pnpm.cmd deploy:check:preview`,
  restore previous override, then `wrangler.cmd deploy --dry-run --config dist/vision/wrangler.json --name vision-preview`.
- [ ] Run `git diff --check`, docs check, and inspect only expected changed paths.
  Stage only reviewed source/tests/docs, excluding ignored synthetic probes.
- [ ] Commit, then fast-forward push `HEAD:refs/heads/codex/phase-c-write-pipeline`.
  Never force push or deploy main.
- [ ] Dispatch existing `preview.yml` with operation none, configure_ai_budget false,
  full reviewed SHA and existing canonical v2 acceptance-context parser. Use Node
  randomBytes for correlation and GitHub CLI JSON stdin; do not disclose the context.
- [ ] Confirm admission, candidate verification, and preview deployment for exact SHA.
  Record only run ID, SHA, Worker version and safe validation counts.
- [ ] Read root/health and signed-out session without credentials or callback queries.
  Ask owner to open preview root, refresh, Sign in with Google, and return only the
  safe category or success. Do not claim authentication or Phase C complete.

## Verified local evidence

- Repository TDD: 26 expected RED failures / 69 passing; first GREEN 95 passing.
- Expanded repository/sync regression: 112 passing, 5 externally gated skips;
  focused OAuth contracts: 16 passing.
- HTTP TDD reported by implementer: 43 RED failures / 130 passing, then 177 GREEN;
  logging: 19 RED failures / 38 passing, then 76 GREEN.
- Parent full verification: 2,005 unit/integration/security, 199 contract, 303 Worker,
  and 47 Chromium tests passed: **2,554 passing; 6 existing skips**.
- Type checks, documentation coverage, build, release security scan, preview config
  validation, and no-upload Wrangler dry run passed. Only existing terminal color warnings.
- Original recovery CTEs compared byte-identical to 7503e0c. Real Neon HTTP-driver
  synthetic probe: 6 accepted + 6 diagnostic cases, 18 intercepted calls, zero network.
- Production observer forwarding is source-traced; live owner sign-in is not verified.

Both independent reviews approved the diagnostic for preview with no required
fixes. The spec reviewer independently passed 195 focused tests (5 external
PostgreSQL skips), 177 Worker auth tests, docs coverage, and diff checks. The
quality reviewer verified source/SQL equivalence and test coverage but did not
rerun full suites; its optional probe stopped in local test-tool startup before
application execution. Parent verification remains the source for full totals.
