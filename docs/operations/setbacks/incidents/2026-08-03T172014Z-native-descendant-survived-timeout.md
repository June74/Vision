# SB-20260803-172014-native-descendant-survived-timeout: Native descendant survived controller timeout cleanup

- **Status:** closed
- **First observed:** 2026-08-03T17:20:14.637828Z
- **Last observed:** 2026-08-03T17:24:43.2774368Z
- **Phase/task:** Phase B corrected redeploy controller verification
- **Environment:** Restricted Windows PowerShell 5.1 local native-process test
- **Version/commit:** candidate `c1911f8`; ignored local corrected redeploy controller

## Symptom

The focused native tree test passed argument roundtrip and timeout classification, then reported native_descendant_survived_timeout.

## Impact

The bounded runner cannot yet guarantee that a timed-out command leaves no child process behind, so live deployment remains paused.

## Reproduction conditions

Run the native tree test where Windows does not confirm `taskkill /T /F`. The
controller's old fallback forcibly stopped the exact root process, then treated
that root exit as proof that its descendant tree had also stopped.

## Safe evidence

- The controller returned `native_process_timeout`, but the unique descendant
  wrote its delayed sentinel afterward.
- After requiring successful tree-termination confirmation, the same restricted
  environment returned `native_process_timeout_cleanup_uncertain`.
- The test forcibly terminated only its own recorded disposable descendant and
  waited for it before deleting its unique temp folder.

## Attempts and outcomes

1. Confirmed the failure occurred after argument roundtrip had passed.
2. Required a zero `taskkill` exit status before declaring whole-tree cleanup.
3. Preserved exact-root termination as a fallback, but classified that result
   as cleanup uncertain rather than success.
4. Updated both timeout tests to accept the explicit fail-closed category while
   retaining deadline and exact-root termination checks.

## Cause classification

- **Confirmed cause:** The fallback verified only the root process after an
  unconfirmed tree kill and incorrectly promoted that evidence to successful
  tree cleanup.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The argument encoder caused the surviving descendant;
  argument roundtrip had already completed successfully.
- **Known exclusions:** No network, provider, database, credential, key, or live
  deployment state was involved.

## Correction and prevention

- **Correction:** Whole-tree cleanup is now reported as confirmed only when
  `taskkill /T /F` succeeds and the root is gone; otherwise the runner emits
  `native_process_timeout_cleanup_uncertain`.
- **Prevention:** Never infer descendant termination solely from root-process
  exit after a tree-kill command fails or cannot be confirmed.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; retain the adversarial descendant regression.

## Verification and related work

The focused tree test passed. The complete native suite then passed all eight
contracts and ended with `corrected_redeploy_native_suite_ok`.

## Recurrence history

- 2026-08-03T17:20:14.637828Z: First observed.
- 2026-08-03T17:24:43.2774368Z: Fail-closed tree cleanup classification and
  deterministic test teardown passed focused and full-suite verification;
  incident closed.
