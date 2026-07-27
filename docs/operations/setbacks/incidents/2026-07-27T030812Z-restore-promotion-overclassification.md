# SB-20260727-030812-restore-promotion-overclassification: Unexpected importer errors were classified as promotion failures

- **Status:** closed
- **First observed:** 2026-07-27T03:08:12Z
- **Last observed:** 2026-07-27T03:12:26.5130820Z
- **Phase/task:** Phase B restore Task 1 fix wave
- **Environment:** Local Phase B worktree
- **Version/commit:** `629c609`

## Symptom

Independent review found that the restore importer classifier mapped every
otherwise-unrecognized `Error` to `restore_promotion_failed`.

## Impact

Unexpected importer failures could produce inaccurate closed evidence,
obscuring the actual unknown-failure boundary. The restore still failed closed
and no provider or target state was accessed during this review.

## Reproduction conditions

Have an importer step outside promotion throw an ordinary error whose constant
message does not match the existing attestation, non-empty-target, or backup
validation categories.

## Safe evidence

`src/jobs/temporary-preview-restore.ts` used
`restore_promotion_failed` as the final `Error` fallback. The evidence records
only that stable source behavior and no runtime error values.

## Attempts and outcomes

- The review finding was confirmed by tracing the classifier and shared
  importer boundaries.
- RED: the new ordinary importer-error regression failed because it received
  `restore_promotion_failed` instead of `restore_unknown_failure`.
- GREEN: promotion now creates a value-free typed marker only around the
  transactional promotion call; unrecognized errors fall back to unknown.

## Cause classification

- **Confirmed cause:** Promotion was represented by the classifier's default
  branch instead of an explicit error type produced only around the promotion
  call.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No restore, provider operation, deployment, key
  handling, or private-value handling occurred.

## Correction and prevention

- **Correction:** Added strict RED/GREEN coverage and an explicit typed
  promotion failure boundary.
- **Prevention:** Closed failure categories must use positive stable
  classification; the fallback category remains unknown.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

- RED command:
  `pnpm.cmd test:unit tests/integration/jobs/temporary-preview-restore.test.ts`
  exited one with exactly 1 failed and 20 passed assertions.
- GREEN command: the same focused file exited zero with 21/21 assertions
  passing.
- The required combined suite exited zero with 37/37 assertions passing.
- `pnpm.cmd typecheck`, `pnpm.cmd docs:check`, and `git diff --check` exited
  zero.
- Related fix-wave commit: pending creation after this record is staged.

## Recurrence history

- 2026-07-27T03:08:12Z: First observed by independent review.
