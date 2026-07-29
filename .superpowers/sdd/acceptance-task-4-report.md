# Acceptance Task 4 implementation report

## RED

- Added focused tests for shared 799/800/899/900/949/950 tiers, invalid cents,
  aggregate ledger consistency, exact 950 stopped evidence, above-limit failure,
  and read-only Gateway verification.
- The repository script test run showed the expected missing Task 4 modules and
  exports. The brief's direct Vitest command was unavailable in this Windows
  worktree; the recurrence is recorded in the setback ledger.

## GREEN and refactor

- Added aggregate-only parameterized AI usage source and closed evidence job.
- Added shared `classifyAiSpendTier`, used by health and evidence.
- Added read-only `verifyAiGatewayBudget`; it issues only list/detail reads.
- Added exact safe-tail reconstruction and printer mode for AI evidence.
- Added paired simple and technical references and kept output free of raw
  ledger, provider, model, token, owner, and error details.

## Verification

- `pnpm.cmd docs:check` passed.
- `pnpm.cmd typecheck` passed.
- Focused unit-project run passed: 6 files, 101 tests.
- `pnpm.cmd build` and `pnpm.cmd security:scan` completed in the named gate;
  Wrangler reported a non-fatal local debug-log write warning, without changing
  project or provider state.

## Self-review and concerns

- Reviewed arithmetic, boundaries, read-only verifier, evidence reconstruction,
  and client-safe fields.
- The preview-only attestation binding and generated candidate builder are
  intentionally not implemented here because the approved plan assigns their
  selector/config-generation surface to Task 6. This Task 4 job accepts only
  the already-admitted non-secret boolean seam.

## Review-fix follow-up

### RED regressions

- Added the Chicago month-boundary assertion and exact approved versioned field
  assertions in the AI evidence job test.
- Added producer/consumer regressions for canonical success, `limit_exceeded`,
  and `unavailable` evidence. Before the fixes, the live job used `MM-YYYY`,
  the field names differed from the approved contract, and safe-tail rejected
  the canonical failure forms.

### GREEN evidence

- `pnpm.cmd typecheck` passed.
- `pnpm.cmd test:unit tests/integration/jobs/phase-b-ai-usage-evidence.test.ts tests/unit/scripts/safe-tail-classifier.test.ts` passed: 2 files, 35 tests.

### Remaining review boundary

- I2/I3 require replacing mock-only aggregate coverage with the real
  PostgreSQL-compatible lifecycle matrix; I5 requires the cross-task candidate
  selector/admission seam. Those changes are not claimed complete in this
  follow-up commit.

## I2/I3/I5 review-fix resolution

### Confirmed causes and RED evidence

- The real PostgreSQL-compatible boundary showed that the aggregate query
  referenced a month column its CTE did not project, so every database-backed
  case became `unavailable`. The prior fabricated rows could not expose this.
- Ledger reconstruction summed both `settled_estimate` and a later `settled`
  event. It also counted only unknown event names rather than validating exact
  lifecycle order and agreement with current reservation state.
- The evidence dependency accepted `nonAiAvailable` as an arbitrary boolean,
  and the scheduled Worker had no AI candidate member, source builder, or
  run/emit function for Task 6 to bind.
- First combined RED:
  `pnpm.cmd test:unit
  tests/integration/data/phase-b-ai-usage-source.test.ts
  tests/integration/jobs/phase-b-ai-usage-evidence.test.ts
  tests/integration/jobs/phase-b-ai-usage-scheduled.test.ts
  tests/integration/jobs/daily-backup.test.ts`.
  Output: 4 files, 34 tests, 17 expected failures and 17 passes.
- The added preview/admission RED then failed all 3 scheduled-seam tests because
  the three requested composition exports did not exist.

### I2/I3 GREEN

- The aggregate now anchors on guaranteed one-row PostgreSQL aggregates and
  distinguishes a genuinely empty owner/month from any reservation or ledger
  activity.
- It reconstructs settled and reserved cents once per current reservation.
  `settled_estimate` followed by late exact `settled` replaces the conservative
  contribution instead of adding a second terminal amount.
- It validates exact allowed histories for `reserved`, `dispatched`,
  `released`, direct `settled`, `settled_estimate`, and late exact settlement,
  including event counts, time order, terminal values, current-state
  agreement, and owner/month attribution.
- The PGlite matrix exercises the actual Drizzle SQL and decoder for empty and
  existing zero rows, every admitted state, late settlement, duplicate
  dispatch, invalid order, state disagreement, and owner/month disagreement.
  Separate decoder-only cases isolate unsafe cells, overflow with otherwise
  agreeing totals, and malformed cells.
- Focused database GREEN:
  `pnpm.cmd test:unit
  tests/integration/data/phase-b-ai-usage-source.test.ts`.
  Output: 1 file, 16 tests, zero failures.

### I5 GREEN and Task 6 boundary

- `runPhaseBAiUsageEvidence()` now performs the usage read followed by fixed
  status and calendar reads. `nonAiAvailable` is true only after both
  deterministic non-AI reads succeed.
- `ScheduledJobDependencies` now includes an `aiUsageEvidence` member.
  `createScheduledPhaseBAiUsageEvidenceDependencies()` composes the three
  owner-scoped read boundaries from only a true same-run Gateway verifier
  boolean.
- The production builder rejects non-preview use and a false attestation before
  database construction. The runner emits exactly one fixed terminal record
  and reports failure only after emission.
- Normal committed crons and unsupported crons never dispatch the AI member.
  The normal configuration, temporary selector, one-minute cron, attestation
  binding generation, and workflow orchestration remain Task 6-owned and are
  not implemented here.
- Focused seam GREEN:
  `pnpm.cmd test:unit
  tests/integration/jobs/phase-b-ai-usage-evidence.test.ts
  tests/integration/jobs/phase-b-ai-usage-scheduled.test.ts
  tests/integration/jobs/daily-backup.test.ts`.
  Output: 3 files, 19 tests, zero failures.

### Final verification and prior-finding recheck

- Covering Task 4 regression: 9 files, 141 tests, zero failures. This includes
  Chicago month selection, shared tier boundaries, exact evidence categories
  and keys, Gateway read-only verification, safe-tail reconstruction, printer
  behavior, normal cron non-dispatch, real lifecycle SQL, and the scheduled
  AI seam.
- AI budget schema contract: 1 file, 13 tests, zero failures.
- `pnpm.cmd typecheck`, `pnpm.cmd docs:check`, and
  `pnpm.cmd security:scan` exited successfully.
- The final task-local-diagnostics `pnpm.cmd build` completed both production
  bundles and the crypto-boundary validator without the optional Wrangler
  log-path warning.
- `git diff --check` passed. Diffs under `migrations/`, committed deployment
  configuration, workflows, and environment secret-inventory documentation are
  empty.
- I1 remains closed by the exact Chicago boundary assertion. I4 remains closed
  by the canonical safe-tail/classifier/printer regression. I6 remains closed
  by the exact approved `vision.ai-usage/v1` field assertions.

## Final I4/M3/M4 re-review resolution

### Root cause and strict RED evidence

- The live observer path is `print-safe-tail` standard input to
  `createSafeTailAccumulator().push()`, then `classifySafeTailLine()`, then the
  terminal locators.
- `classifySafeTailLine()` returned the first valid locator result. The
  foundation locator ran before the AI locator and its private terminal list
  omitted both the AI action and `vision.ai-usage/v1`, so a canonical
  foundation plus canonical AI event was returned as foundation evidence.
- The first regression-only run was:
  `pnpm.cmd test:unit tests/unit/scripts/safe-tail-classifier.test.ts`.
  Output: 1 file, 34 tests, 2 expected mixed-order failures and 32 passes. Both
  foundation-first and AI-first cases returned foundation evidence instead of
  `null`.
- The minimal foundation vocabulary correction made that file GREEN at 34/34.
- A second shared-vocabulary RED added AI plus every registered terminal kind
  in both orders. Output: 1 file, 35 tests, 1 expected failure and 34 passes.
  The maintenance-first path returned canonical maintenance evidence when AI
  evidence was present.

### GREEN and auditability refactor

- One `TERMINAL_IDENTITIES` registry now defines every terminal action and
  evidence discriminator. `hasMixedTerminalKinds()` scans the entire event
  before any locator runs, so cross-kind messages and action/evidence
  mismatches fail closed independent of message or locator order.
- Foundation, maintenance, and AI locators use named terminal-kind helpers
  instead of separate incomplete string lists.
- The AI classifier now exposes its decision structure through named exact
  shape, unavailable-form, canonical-match, and reconstruction helpers. The AI
  locator uses expanded duplicate, envelope, and classification branches.
- The exhaustive canonical matrix now covers `none`, `limit_exceeded`,
  `inconsistent`, and `unavailable` directly and through the one-minute tail.
  Additional tests cover duplicate, wrong-action, wrong-cron, extra-key,
  accessor, symbol, hidden-key, and non-plain-prototype rejection.
- Focused AI/foundation classifier and printer GREEN:
  `pnpm.cmd test:unit tests/unit/scripts/safe-tail-classifier.test.ts
  tests/unit/scripts/print-safe-tail.test.ts`.
  Output: 2 files, 54 tests, zero failures. The printer coverage includes
  `--ai-usage-only` success, fixed fallback, and combined-mode rejection.

### Final verification

- The covering AI, foundation, safe-tail, scheduler, budget, health, and
  Gateway slice passed: 11 files, 202 tests, zero failures.
- The AI budget schema contract passed: 1 file, 13 tests, zero failures.
- `pnpm.cmd typecheck`, `pnpm.cmd docs:check`, `pnpm.cmd build`, and
  `pnpm.cmd security:scan` exited successfully.
- `git diff --check` passed. Migration and committed
  deployment/secret-inventory surfaces remain unchanged.
- No Task 6 selector, binding generation, one-minute cron configuration, or
  orchestration was added.
