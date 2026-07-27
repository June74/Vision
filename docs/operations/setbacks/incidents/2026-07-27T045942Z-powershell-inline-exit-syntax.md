# SB-20260727-045942-powershell-inline-exit-syntax: PowerShell inline exit check did not parse

- **Status:** closed
- **First observed:** 2026-07-27T04:59:42Z
- **Last observed:** 2026-07-27T04:59:42Z
- **Phase/task:** Phase B restore Task 3 review
- **Environment:** Local Phase B worktree
- **Version/commit:** `e05354b` with the Task 3 candidate

## Symptom

A bounded review command embedded a Git command and exit-code read inside a
PowerShell expression, which the parser rejected.

## Impact

The command did not execute, no source content was printed, and no file,
provider, credential, or runtime state changed.

## Reproduction conditions

Place a semicolon-separated command sequence directly inside a cast expression
instead of storing its exit code first.

## Safe evidence

PowerShell reported unmatched expression syntax before command execution.

## Attempts and outcomes

- The combined review command was rejected.
- The retry stores each Git result in a named variable before formatting safe
  boolean output.

## Cause classification

- **Confirmed cause:** Invalid PowerShell expression composition.
- **Hypotheses:** None.
- **Rejected hypotheses:** Repository content and Git state were not involved.
- **Known exclusions:** No private source line or value was emitted.

## Correction and prevention

- **Correction:** Separate command execution from boolean formatting.
- **Prevention:** Do not place semicolon-separated command sequences inside
  casts or parenthesized expressions.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected bounded review command must return the requested booleans and
counts before the candidate is staged.

## Recurrence history

- 2026-07-27T04:59:42Z: First observed and contained.
