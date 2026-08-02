# SB-20260801-191721-task7-task3-powershell-colon-interpolation: Task 3 discovery used invalid PowerShell colon interpolation

- **Status:** contained
- **First observed:** 2026-08-01T19:17:21.583131Z
- **Last observed:** 2026-08-01T22:10:50.7173472Z
- **Phase/task:** Phase B Task 7 correlation repair Task 3
- **Environment:** Windows PowerShell in the isolated Phase B worktree
- **Version/commit:** Uncommitted repair based on `10b228bc2c18647f6a8a19c2dd5ad740e7f7491e`

## Symptom

A read-only discovery command placed a colon immediately after an interpolated variable, causing InvalidVariableReferenceWithDrive during parsing.

## Impact

Task 3 did not start. Parsing failed before any command body, process, read, file edit, provider action, or live action began.

## Reproduction conditions

Place a colon immediately after an unbraced variable inside one double-quoted
PowerShell interpolation.

## Safe evidence

- PowerShell returned `InvalidVariableReferenceWithDrive` during parsing.
- The failure occurred before the command body started.
- A replacement exact-path read confirmed all six Task 3 inputs are readable
  and nonempty.

## Attempts and outcomes

- The first agent stopped immediately without a workaround.
- Root replaced constructed interpolated labels with exact literal-path reads.
- The bounded readability check succeeded for all Task 3 inputs.

## Cause classification

- **Confirmed cause:** PowerShell interpreted the unbraced variable followed by
  a colon as a drive-qualified reference.
- **Hypotheses:** None remain.
- **Rejected hypotheses:** No repository, test, or Task 3 design defect caused
  the parser error.
- **Known exclusions:** No process, file read/write, provider, network, secret,
  calendar, database, R2, deployment, workflow, backup-key, staging, or commit
  action began on the failed command.

## Correction and prevention

- **Correction:** Use exact `Get-Content -LiteralPath` reads without constructed
  interpolated labels.
- **Prevention:** Avoid a colon immediately after PowerShell interpolated
  variables; prefer structured objects or braced variables when labels are
  actually required.
- **Owner:** Codex.
- **Next diagnostic step:** Retry Task 3 with the exact-file-only restriction.

## Verification and related work

Closed after all six Task 3 inputs were read successfully by exact literal path
and confirmed nonempty.

## Recurrence history

- 2026-08-01T19:17:21.583131Z: First observed.
- 2026-08-01T22:10:50.7173472Z: Root repeated the unbraced-variable-before-
  colon pattern in a counts-only frozen-package locator. PowerShell rejected
  the command at parse time before reading any source line or exposing the
  matched value. The retry uses format arguments rather than interpolation.
