# SB-20260801-172153-task8-safe-git-assert-tip-failed-closed: Task 8 safe remote-tip assertion failed closed

- **Status:** closed
- **First observed:** 2026-08-01T17:21:53.8460773Z
- **Last observed:** 2026-08-01T17:45:19.3061456Z
- **Phase/task:** Phase B Task 8 read-only reconciliation and provider-capability probing
- **Environment:** Default sandbox versus approved scoped external execution
- **Version/commit:** admitted Task 7 candidate

## Symptom

The permanent `assert_tip` adapter exited nonzero and emitted only its fixed
privacy-safe failure category during a fresh non-mutating equality check.

## Impact

Current remote equality is not re-proved. The earlier successful equality
evidence remains historical, but Task 8 cannot rely on it as current until the
failure is classified or a fresh safe assertion succeeds. No push, dispatch,
deployment, source edit, provider mutation, credential operation, calendar
action, AI request, database action, or R2 action occurred.

## Reproduction conditions and safe evidence

Invoke the permanent adapter for the reviewed branch and exact admitted commit.
The adapter captures and discards both child streams and exposes only a fixed
failure category.

## Cause classification

- **Confirmed cause:** The default sandbox process lacked usable remote Git
  authentication context; its fixed-category diagnostic returned
  `authentication_unavailable`. The same permanent adapter succeeded under
  the approved scoped execution boundary.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Actual reviewed-branch movement was rejected by the
  fresh successful permanent-adapter equality proof.
- **Known exclusions:** No raw remote output, URL, argument material, provider
  identifier, account data, or credential was displayed or retained.

## Attempts and outcomes

1. The fresh read-only adapter call failed closed exactly once.
2. No direct remote Git command was attempted and no retry has occurred.

## Correction and prevention

- **Correction:** Classify authentication/network availability through
  fixed-category, captured checks; retry the permanent adapter only after the
  failure boundary is understood.
- **Prevention:** Never replace a closed adapter failure with raw
  `ls-remote`, raw push output, or provider identifiers.
- **Owner:** Codex.
- **Next diagnostic step:** Run bounded status-only authentication/network
  checks and compare only safe categories.

## Verification and related work

The scoped permanent `assert_tip` adapter emitted only `True`, freshly proving
the reviewed branch still equals the admitted Task 7 candidate without
exposing remote child output.

## Recurrence history

- 2026-08-01T17:42:51.8819862Z: A closed-output, read-only GitHub run-detail
  capability probe encountered the same sandbox authentication/network
  boundary. It emitted only `authentication_or_network_unavailable`, an exit
  code, and `RawOutputDisplayed=false`. No run identifier, input value, URL,
  credential, or provider payload was displayed. The exact probe will be
  retried only under the scoped external execution boundary.
- 2026-08-01T17:45:19.3061456Z: The exact probe succeeded under scoped external
  execution. It returned only closed booleans and a zero field count, proving
  the run-detail response does not expose dispatch inputs. Raw provider output,
  run identifiers, and input values were captured and discarded. The sandbox
  boundary is classified and this recurrence is closed.
