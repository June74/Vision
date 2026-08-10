# SB-20260726-191644-powershell-local-command-call-operator: PowerShell call operator was omitted

- **Status:** closed
- **First observed:** 2026-07-26T19:16:44.231522Z
- **Last observed:** 2026-08-07T19:50:20Z
- **Phase/task:** Phase B deployment fix tests
- **Environment:** Local Windows PowerShell
- **Version/commit:** `codex/phase-b-foundation`

## Symptom

A quoted local executable path was followed by arguments without the PowerShell call operator, causing a parse error before execution.

## Impact

Neither the intended logger call nor the test ran in that command; no files or provider state changed.

## Reproduction conditions

Place a quoted executable path before arguments without PowerShell's `&`
operator.

## Safe evidence

PowerShell rejected the command during parsing, so no segment ran.

## Attempts and outcomes

- The first fallback command failed during parsing.
- The corrected command used the call operator and ran the test executable.

## Cause classification

- **Confirmed cause:** A quoted path is a string expression unless invoked with
  PowerShell's call operator.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No partial logger or test state was created.

## Correction and prevention

- **Correction:** Added `&` before the quoted local executable path.
- **Prevention:** Use the call operator for every quoted executable path.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected invocation ran the RED suite and the later GREEN suite.

## Recurrence history

- 2026-07-26T19:16:44.231522Z: First observed.
- 2026-08-07T19:50:20Z: The Wrangler login command was attempted from the
  project parent or without a valid local invocation shape, so PowerShell could
  not find the executable. The exact Phase B worktree and binary both exist;
  no login, provider, or repository state changed.
