# SB-20260806-215416-direct-launcher-negative-test-error-handling: Negative launcher test treated expected exit as fatal

- **Status:** closed
- **First observed:** 2026-08-06T21:54:16.8593528Z
- **Last observed:** 2026-08-06T21:58:34.0614582Z
- **Phase/task:** Phase B direct candidate-launcher active-state regression
- **Environment:** Local Windows PowerShell TDD test
- **Version/commit:** ignored operational launcher/test; no application or provider mutation

## Symptom

The malformed-active-state regression correctly caused the launcher to exit
nonzero, but the test's global `ErrorActionPreference = Stop` treated the
expected native failure as a test error before it could inspect `$LASTEXITCODE`.

## Impact

The test harness did not reach its assertion. The launcher behavior itself was
the intended fail-closed result; no child or provider process ran.

## Reproduction conditions

Invoke the intentionally failing launcher from a PowerShell test with
terminating error handling and no temporary nonterminating-error scope.

## Safe evidence

Only the allowlisted launcher category `direct_launcher_active_state_invalid`
was observed. No raw child output or private value was emitted.

## Attempts and outcomes

- The launcher rejected malformed active state as designed.
- The test stopped before checking the nonzero exit.
- The test now captures the expected nonzero exit code inside a temporary
  nonterminating-error scope and restores the prior preference.

## Cause classification

- **Confirmed cause:** Test-only error handling was too strict for its negative
  subprocess assertion.
- **Hypotheses:** None.
- **Rejected hypotheses:** Launcher rejection was not an implementation bug.
- **Known exclusions:** No network, provider, application, credential, key,
  schedule, deployment, Git, or tracked-file state changed.

## Correction and prevention

- **Correction:** Temporarily use nonterminating error handling around the
  intentional negative child invocation, then restore the prior preference.
- **Prevention:** Negative subprocess tests must assert exit status without
  swallowing unexpected setup errors.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Rerun the full direct-launcher contract.

## Verification and related work

The direct-launcher contract passed, including the malformed active-state
negative case and the normal child-launch path. No provider-facing process was
started.

## Recurrence history

- 2026-08-06T21:54:16.8593528Z: First observed and contained.
- 2026-08-06T21:58:34.0614582Z: Closed after the corrected negative assertion
  and complete local gate set passed.
