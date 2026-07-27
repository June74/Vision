# SB-20260727-045312-promotion-error-test-regression: Older promotion test missed typed-error change

- **Status:** closed
- **First observed:** 2026-07-27T04:50:48Z
- **Last observed:** 2026-07-27T04:53:12Z
- **Phase/task:** Phase B restore Task 3 verification
- **Environment:** Local Phase B worktree
- **Version/commit:** `e05354b` with the Task 3 candidate

## Symptom

The complete unit gate had one deterministic failure in the older encrypted
backup round-trip suite. Its assertion expected obsolete promotion-error
wording after Task 1 introduced a value-free typed promotion marker.

## Impact

No product behavior, provider state, secret, key, target, or private value was
affected. The Task 3 unit gate paused with 666 assertions passing, one failing,
and one skipped.

## Reproduction conditions

Run the focused backup round-trip file after the Task 1 typed promotion marker
change.

## Safe evidence

The focused file reproduced exactly one failed and 29 passed assertions. Source
history showed the older text assertion predated the typed-error change.

## Attempts and outcomes

- The complete unit gate exposed the mismatch.
- The focused file reproduced it deterministically.
- The assertion now checks the exported error class rather than message text.

## Cause classification

- **Confirmed cause:** The Task 1 fix wave changed promotion failure to an
  explicit value-free error type but omitted the older round-trip assertion.
- **Hypotheses:** None.
- **Rejected hypotheses:** The failure was not intermittent and did not involve
  Task 3 preview configuration or Worker scanning.
- **Known exclusions:** Runtime restore behavior remained fail-closed.

## Correction and prevention

- **Correction:** Assert rejection with `BackupRestorePromotionError`.
- **Prevention:** When a shared error contract becomes typed, search all older
  message-match assertions before closing the fix wave.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The focused file and a fresh complete unit gate must pass before Task 3 can be
committed.

## Recurrence history

- 2026-07-27T04:50:48Z: First observed and contained.
