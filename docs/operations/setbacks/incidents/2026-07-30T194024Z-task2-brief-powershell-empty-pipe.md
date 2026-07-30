# SB-20260730-194024-task2-brief-powershell-empty-pipe: Task 2 brief metadata command had an empty PowerShell pipe element

- **Status:** closed
- **First observed:** 2026-07-30T19:40:24.947456Z
- **Last observed:** 2026-07-30T19:40:40.6551859Z
- **Phase/task:** Phase B live-acceptance closure Task 2 brief preparation
- **Environment:** Local Windows PowerShell, read-only brief preparation
- **Version/commit:** `6bd0e450885b3c3aa38f3ba38289e1371b3cbb43`

## Symptom

A read-only metadata-count command failed at parse time with PowerShell EmptyPipeElement.

## Impact

Brief preparation was delayed; the command performed no file read, write, provider call, network access, or private-data output.

## Reproduction conditions

Pipe a `foreach` statement directly into a formatting command without first
capturing or grouping the loop result.

## Safe evidence

PowerShell rejected the command at parse time with the safe category
`EmptyPipeElement`. The equivalent corrected command returned four nonempty
local document metadata records.

## Attempts and outcomes

- The direct loop-to-pipe shape failed before execution.
- Capturing the loop output into a variable and piping that variable succeeded.

## Cause classification

- **Confirmed cause:** The command used an invalid direct `foreach` statement
  position before a pipe in Windows PowerShell.
- **Hypotheses:** None.
- **Rejected hypotheses:** No file or encoding problem occurred because parsing
  failed before any read.
- **Known exclusions:** No file write, provider call, network access, private
  output, or external state change occurred.

## Correction and prevention

- **Correction:** Capture `foreach` output first, then pipe the completed
  collection.
- **Prevention:** Use an assignment or explicit grouping before piping
  statement output in Windows PowerShell metadata probes.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected command exited zero and reported four metadata rows, all
nonempty, without rendering file contents.

## Recurrence history

- 2026-07-30T19:40:24.947456Z: First observed.
