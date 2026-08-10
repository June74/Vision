# SB-20260803-212326-powershell-finally-pipeline-parse-error: PowerShell source scan piped directly after finally

- **Status:** closed
- **First observed:** 2026-08-03T21:23:26.754535Z
- **Last observed:** 2026-08-03T21:39:36.4134641Z
- **Phase/task:** Phase B candidate deployment failure diagnosis
- **Environment:** Windows PowerShell 5.1 bounded local Wrangler source scan
- **Version/commit:** diagnostic only; no product or provider change

## Symptom

A bounded read-only Wrangler source scan failed at parse time because its try/finally statement was followed directly by a pipeline.

## Impact

No source, provider, deployment, credential, or external state changed; the local source scan was delayed until its output was accumulated separately.

## Reproduction conditions

Place a pipeline directly after a PowerShell `try`/`finally` statement rather
than piping a separately assigned result collection.

## Safe evidence

PowerShell stopped at parse time with an empty-pipeline-element error. No file
was read by the malformed command.

## Attempts and outcomes

The malformed scan failed once. The corrected scan accumulated match objects
in a variable, disposed the reader in `finally`, and serialized the collection
after the statement.

## Cause classification

- **Confirmed cause:** PowerShell does not permit directly piping the complete
  `try`/`finally` statement in that position.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Wrangler source corruption or an unreadable source
  file.
- **Known exclusions:** No source, provider, deployment, credential, or
  external state changed.

## Correction and prevention

- **Correction:** Accumulate results, close the reader in `finally`, and pipe
  only the result variable afterward.
- **Prevention:** Keep resource-disposal statements and output pipelines as
  separate PowerShell statements.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The corrected bounded source scan completed and returned only fixed match text
and line numbers.

## Recurrence history

- 2026-08-03T21:23:26.754535Z: First observed.
- 2026-08-03T21:25:23.6971358Z: Corrected source scan verified; incident
  closed.
- 2026-08-03T21:30:19.8551219Z: Recurred when ledger verification piped
  directly after a `foreach` statement. PowerShell again stopped at parse time;
  the corrected command accumulated results first, then verified all nine
  incident rows and their headers. No file or provider state changed.
- 2026-08-03T21:39:36.4134641Z: Recurred in a local two-artifact config
  summary that again piped directly after `foreach`. The command stopped at
  parse time; an explicit result collection then completed. No source or
  provider state changed.
