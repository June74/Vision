# SB-20260727-131409-pnpm-powershell-wrapper-policy: PowerShell blocked the package-manager script wrapper

- **Status:** closed
- **First observed:** 2026-07-27T13:14:09Z
- **Last observed:** 2026-07-30T01:11:37.7754332Z
- **Phase/task:** Phase B acceptance instrumentation final whole-branch review
- **Environment:** Local Windows verification shell
- **Version/commit:** `7d2f9f6`; reviewed candidate `0f08fc1`

## Symptom

The focused unit-test command could not start because the PowerShell package-manager script wrapper was blocked by local signing policy.

## Impact

No test process ran on the first attempt. No production code or provider data was affected.

## Reproduction conditions

Invoke the package-manager command through its PowerShell script wrapper in this local verification environment.

## Safe evidence

- The shell reported a script-signing policy error before the test runner started.
- No test, provider, or secret output was produced.

## Attempts and outcomes

1. Started the focused unit-test command through the PowerShell wrapper: blocked before execution.
2. Switched to the Windows command shim for the identical test runner invocation: the wrapper started and reached local binary resolution.

## Cause classification

- **Confirmed cause:** The local PowerShell execution policy rejected the package-manager script wrapper.
- **Hypotheses:** None open.
- **Rejected hypotheses:** The test suite itself did not fail because it never started.
- **Known exclusions:** No repository source, configuration, credentials, or provider state changed.

## Correction and prevention

- **Correction:** Invoke the Windows command shim for local package-manager verification.
- **Prevention:** Use the command shim for subsequent package-manager checks in this environment.
- **Owner:** Codex.
- **Next diagnostic step:** None for the PowerShell policy boundary.

## Verification and related work

- The Windows command shim passed the PowerShell policy boundary; local binary resolution is tracked separately.

## Recurrence history

- 2026-07-28T01:20:44.6624354Z: Recurred when Task 3 candidate
  reconfirmation invoked the script-form package-manager launcher. PowerShell
  rejected it before test startup. The repository-local Windows test wrapper
  subsequently ran the exact five focused files with 59 passing tests. No
  provider or private-data boundary was involved.
- 2026-07-30T01:11:37.7754332Z: Recurred when the independent whole-branch
  reviewer invoked a focused regression through the script-form launcher.
  PowerShell rejected it before the test process started. The reviewer stopped
  without retrying, editing the repository, or accessing external state; the
  implementer's command-shim evidence remains recorded separately.
