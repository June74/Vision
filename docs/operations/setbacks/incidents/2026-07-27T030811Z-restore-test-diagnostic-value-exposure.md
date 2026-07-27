# SB-20260727-030811-restore-test-diagnostic-value-exposure: Restore tests could render private-shaped values on assertion failure

- **Status:** closed
- **First observed:** 2026-07-27T03:08:11.5689988Z
- **Last observed:** 2026-07-27T03:12:26.5130820Z
- **Phase/task:** Phase B restore Task 1 fix wave
- **Environment:** Local Phase B worktree
- **Version/commit:** `629c609`

## Symptom

Independent review found equality and negative-containment assertions that
directly examined restore bindings, target identities, object identities, or
private-shaped test values.

## Impact

No assertion failed with a private value during this review and no actual
private value was handled. If one of the affected assertions failed later, its
test-runner diagnostic could render the examined synthetic or private binding.

## Reproduction conditions

Cause one of the identified direct string equality or negative-containment
assertions to fail in the temporary restore integration or environment-schema
tests.

## Safe evidence

The review package identified the affected assertion groups in
`tests/integration/jobs/temporary-preview-restore.test.ts` and
`tests/unit/server/env.test.ts`. This record retains only file paths and safe
assertion categories.

## Attempts and outcomes

- The review finding was reproduced by source inspection.
- Every identified matcher was replaced with a boolean-only assertion shape.
- A regression deliberately triggered the shared helper and confirmed that the
  rendered matcher diagnostic omitted the examined private-shaped value.

## Cause classification

- **Confirmed cause:** The assertions passed private-shaped strings directly
  to matchers whose failure diagnostics render examined values.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No provider access, deployment, secret value, database
  binding, or protected application record was used.

## Correction and prevention

- **Correction:** Replaced direct equality and negative-containment matchers
  with precomputed booleans, and added a diagnostic-safety regression check.
- **Prevention:** Test privacy boundaries through booleans or constant,
  value-free mock errors; never pass private-shaped values to diagnostic
  matchers.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

- `pnpm.cmd test:unit tests/integration/jobs/temporary-preview-restore.test.ts tests/unit/server/env.test.ts`
  exited zero with 37/37 assertions passing.
- `pnpm.cmd typecheck` and `pnpm.cmd docs:check` exited zero.
- `git diff --check` exited zero.
- Related fix-wave commit: pending creation after this record is staged.

## Recurrence history

- 2026-07-27T03:08:11.5689988Z: First observed by independent review.
