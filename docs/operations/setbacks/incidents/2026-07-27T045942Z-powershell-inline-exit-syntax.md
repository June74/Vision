# SB-20260727-045942-powershell-inline-exit-syntax: PowerShell inline exit check did not parse

- **Status:** closed
- **First observed:** 2026-07-27T04:59:42Z
- **Last observed:** 2026-07-27T17:41:12Z
- **Phase/task:** Phase B restore Tasks 3-4
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
  casts or parenthesized expressions, and do not pipe directly from a
  `foreach` statement without first assigning its output.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected bounded review command must return the requested booleans and
counts before the candidate is staged.

## Recurrence history

- 2026-07-27T04:59:42Z: First observed and contained.
- 2026-07-27T05:15:34Z: Recurred when a bounded workflow inspection piped
  directly from a `foreach` statement. PowerShell rejected the empty pipe
  element before execution; no source or provider data was read or changed.
  The retry assigns the loop output before formatting.
- 2026-07-27T17:41:12Z: Recurred in a bounded rollback-ref classifier using
  the same direct `foreach` pipe shape. PowerShell rejected it before reading
  commit content or changing state. The retry assigns the loop results before
  JSON conversion.
- 2026-08-01T00:56:00.0000000Z: Recurred when a Gate 0 read-only probe placed
  a Git command and `$LASTEXITCODE` inside one parenthesized Boolean
  expression. PowerShell rejected the script before any check ran or state
  changed. The retry runs the command first, stores its exit code, then emits
  the Boolean.
- 2026-08-01T00:58:00.0000000Z: Recurred when the Gate 0 preview-artifact
  probe omitted one closing parenthesis in its final inline Boolean output.
  PowerShell rejected the script before the build started. The retry assigns
  every Boolean to a named variable before emitting it.
