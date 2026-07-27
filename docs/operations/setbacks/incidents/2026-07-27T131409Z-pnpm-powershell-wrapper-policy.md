# SB-20260727-131409-pnpm-powershell-wrapper-policy: PowerShell blocked the package-manager script wrapper

- **Status:** closed
- **First observed:** 2026-07-27T13:14:09Z
- **Last observed:** 2026-07-27T13:14:09Z
- **Phase/task:** Phase B restore Task 4 tail correction
- **Environment:** Local Windows verification shell
- **Version/commit:** Pending correction commit

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
