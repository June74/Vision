# SB-20260802-222919-reconnect-helper-static-validator-false: Candidate database helper static checks returned false

- **Status:** closed
- **First observed:** 2026-08-02T22:29:19.898947Z
- **Last observed:** 2026-08-02T22:29:58.8534416Z
- **Phase/task:** Phase B OAuth reconnect Task 5 detached-candidate PostgreSQL proof preparation
- **Environment:** Local PowerShell AST/static validation
- **Version/commit:** candidate `c1911f8`

## Symptom

Two static validation patterns did not find the short-candidate target and masked prompt while the helper syntax and remaining privacy checks passed.

## Impact

The owner was not asked to run the helper; no database, credential, provider, artifact, or deployment state changed.

## Reproduction conditions

Apply the first inline regular expressions to a helper whose target uses
double quotes and whose `Read-Host` parameters span continued lines.

## Safe evidence

The first check returned false for only target/prompt detection while syntax,
zeroization, environment cleanup, safe marker, and no-echo checks passed. An
exact bounded read showed the expected target and masked parameter. No private
value was involved.

## Attempts and outcomes

- The owner was not asked to execute an unverified helper.
- A normalized-text plus PowerShell-AST verifier returned true for every
  required target, identity, masking, zeroization, cleanup, and output guard.

## Cause classification

- **Confirmed cause:** The validator assumed single quotes and same-line
  command parameters; the helper correctly used double quotes and PowerShell
  line continuations.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The helper does not target the short candidate or
  does not mask input; AST and resolved-path checks disproved both.
- **Known exclusions:** No helper defect, source change, database access,
  credential, provider action, key access, calendar action, or deployment.

## Correction and prevention

- **Correction:** Validate command parameters through the PowerShell AST and
  normalize whitespace/quotes only for structural target checks.
- **Prevention:** Do not use line- and quote-sensitive regexes for PowerShell
  command semantics.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected verifier returned syntax error count zero and true for the short
candidate target, masked prompt, candidate identity guard, BSTR zeroization,
environment cleanup, and safe success/failure markers.

## Recurrence history

- 2026-08-02T22:29:19.898947Z: First observed.
- 2026-08-02T22:29:58.8534416Z: Closed after root-cause confirmation and the
  complete AST/resolved-path verification passed without changing the helper.
