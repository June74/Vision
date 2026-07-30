# SB-20260730-001654-select-string-recurse-unsupported: Select-String rejected a recurse parameter

- **Status:** closed
- **First observed:** 2026-07-30T00:16:54.4369723Z
- **Last observed:** 2026-07-30T00:16:54.4369723Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final re-review
- **Environment:** Local Windows PowerShell
- **Version/commit:** `dc3a517`

## Symptom

The independent Task 7 reviewer used a recurse parameter that this PowerShell
version does not support on `Select-String`. The read-only source trace stopped
before returning matches.

## Impact

The reviewer paused after opening the immutable package once. No worktree,
index, branch, provider, or private state changed, and no review verdict was
written.

## Reproduction conditions

Invoke `Select-String` with its unsupported recurse parameter in this Windows
PowerShell environment.

## Safe evidence

PowerShell returned a named-parameter-not-found category before reading source
matches. No source lines or private values were rendered.

## Attempts and outcomes

- The unsupported command failed before producing matches.
- A bounded `Get-ChildItem` recursive file pipeline into `Select-String`
  completed successfully without rendering source content.

## Cause classification

- **Confirmed cause:** Recursive file discovery belongs to `Get-ChildItem` in
  this PowerShell version; `Select-String` cannot perform it through the
  attempted parameter.
- **Hypotheses:** None.
- **Rejected hypotheses:** Repository corruption or a source-access failure.
- **Known exclusions:** No repository mutation, provider access, secret
  exposure, or review-report write occurred.

## Correction and prevention

- **Correction:** Discover files with `Get-ChildItem -Recurse -File`, then pipe
  the bounded set into `Select-String`.
- **Prevention:** Do not infer PowerShell parameter parity from another shell
  or version; use the already verified pipeline form.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

A sentinel no-match search through the corrected bounded pipeline exited
successfully before the review was rescheduled.

## Recurrence history

- 2026-07-30T00:16:54.4369723Z: First observed, contained, corrected, and
  verified locally without source output.
