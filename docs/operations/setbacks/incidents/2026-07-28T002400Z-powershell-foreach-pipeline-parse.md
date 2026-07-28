# SB-20260728-002400-powershell-foreach-pipeline-parse: PowerShell rejected a direct foreach-to-pipeline expression

- **Status:** closed
- **First observed:** 2026-07-28T00:24:00Z
- **Last observed:** 2026-07-28T00:25:50Z
- **Phase/task:** Listener-first restore retry Task 2 implementation
- **Environment:** Local Phase B worktree
- **Version/commit:** `ff6a767`

## Symptom

A read-only file line-count inventory put a pipeline directly after a
`foreach` statement. PowerShell rejected the command before execution with an
empty-pipe parse error.

## Impact

No file, database, provider, browser, or network action occurred. Task 2
implementation was briefly delayed while the command shape was corrected.

## Reproduction conditions and safe evidence

In this PowerShell version, place `| Format-Table` immediately after the
closing brace of a `foreach` statement. The parser rejects the expression
before any loop body runs.

## Attempts and outcomes

- The invalid inspection command failed before execution.
- Subsequent commands avoided piping directly from `foreach`.

## Cause classification

- **Confirmed cause:** The command used a PowerShell grammar shape that does
  not permit a direct pipeline after the `foreach` statement.
- **Hypotheses:** None.
- **Rejected hypotheses:** The inspected files were not missing and no
  repository command caused the parse failure.
- **Known exclusions:** No private value was read or written.

## Correction and prevention

- **Correction:** Emit the inventory objects without a trailing direct
  pipeline, or collect them into a variable before formatting.
- **Prevention:** Keep read-only preflight loops syntactically simple.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

Later read-only inspection commands completed with corrected PowerShell syntax.
