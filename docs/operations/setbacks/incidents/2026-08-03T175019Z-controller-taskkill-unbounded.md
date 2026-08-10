# SB-20260803-175019-controller-taskkill-unbounded: Controller process-tree cleanup command lacked a deadline

- **Status:** closed
- **First observed:** 2026-08-03T17:50:19.008493Z
- **Last observed:** 2026-08-03T17:52:43.9761767Z
- **Phase/task:** Phase B corrected redeploy controller re-review
- **Environment:** Local Windows PowerShell 5.1 corrected-controller suite
- **Version/commit:** candidate `c1911f8`; ignored local operational controller

## Symptom

Independent re-review found that taskkill.exe was invoked synchronously without its own timeout after a native timeout or output-limit breach.

## Impact

The controller could still block indefinitely during cleanup, so live validation and deployment remain paused.

## Reproduction conditions

Invoke a cleanup utility that starts successfully and then remains alive beyond
its own cleanup deadline.

## Safe evidence

The original tree cleanup invoked the fixed system cleanup executable directly
through PowerShell's call operator. That call had no timeout even though the
native command it was cleaning up did.

## Attempts and outcomes

1. Added a non-recursive `ProcessStartInfo` helper with redirected/closed input,
   asynchronous output draining, a five-second production deadline, and a
   short bounded termination grace period.
2. The helper returns false for start errors, nonzero exit, or timeout; the
   caller therefore emits cleanup uncertainty instead of claiming success.
3. A fake hanging child, exit-zero child, and exit-seven child passed the new
   isolated regression.

## Cause classification

- **Confirmed cause:** The cleanup executable was outside the controller's
  otherwise bounded process lifecycle.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The main native timeout also bounds its cleanup
  command.
- **Known exclusions:** No network, provider, database, credential, key, or
  live deployment state changed.

## Correction and prevention

- **Correction:** Route only the fixed cleanup utility through a separate
  bounded non-recursive process helper.
- **Prevention:** Deadlines must cover recovery and cleanup operations, not only
  the primary command.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; retain the cleanup-deadline regression.

## Verification and related work

The focused cleanup regression passed, followed by the full twelve-check suite
ending `corrected_redeploy_native_suite_ok`. Independent final re-review found
no Critical or Important issue and confirmed the helper cannot recurse into
tree cleanup.

## Recurrence history

- 2026-08-03T17:50:19.008493Z: First observed.
- 2026-08-03T17:52:43.9761767Z: Focused/full verification and independent
  re-review passed; incident closed.
