# SB-20260806-215024-direct-launcher-quote-parse-error: Direct launcher command quote did not parse

- **Status:** closed
- **First observed:** 2026-08-06T21:50:24.0409130Z
- **Last observed:** 2026-08-06T21:58:34.0614582Z
- **Phase/task:** Phase B direct candidate-launcher repair
- **Environment:** Local Windows PowerShell no-provider TDD GREEN run
- **Version/commit:** ignored operational launcher; no application or provider mutation

## Symptom

The first implementation of the direct process launcher used an invalid
PowerShell escape for the outer `cmd.exe /c` quotes, so the launcher parser
failed before it could start the no-provider fixture.

## Impact

The launcher GREEN test failed as an expected local implementation defect. No
live controller, provider, schedule, binding, secret, or deployment action ran.

## Reproduction conditions

Parse the launcher version that built `$cmdArguments` with a backslash-escaped
double quote inside a PowerShell double-quoted string.

## Safe evidence

PowerShell reported `UnexpectedToken` in the launcher quote expression. No
raw output, path payload, credential, identifier, or provider response was
emitted.

## Attempts and outcomes

- TDD RED correctly preceded implementation.
- The first GREEN attempt exposed the syntax defect.
- The correction uses a single-quoted PowerShell literal for the outer quotes.

## Cause classification

- **Confirmed cause:** PowerShell uses the backtick for escaping, not a
  backslash, inside double-quoted strings.
- **Hypotheses:** None.
- **Rejected hypotheses:** The direct process API or path containment caused
  this failure; parsing stopped before either was exercised.
- **Known exclusions:** No network, provider, application, credential, key,
  schedule, deployment, Git, or tracked-file state changed.

## Correction and prevention

- **Correction:** Build the outer `/c` quotes from a single-quoted literal and
  rerun the provider-free launcher contract.
- **Prevention:** Run the PowerShell parser before every launcher behavior test.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Verify parser zero and the complete local launcher
  contract.

## Verification and related work

Parser validation passed and the direct-launcher contract emitted
`direct_candidate_launcher_contract_ok`. The complete local gate set also
passed; no provider-facing process was started.

## Recurrence history

- 2026-08-06T21:50:24.0409130Z: First observed and contained before launch.
- 2026-08-06T21:58:34.0614582Z: Closed after parser and direct-launcher
  no-provider contract passed.
