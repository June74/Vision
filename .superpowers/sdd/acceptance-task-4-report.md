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
