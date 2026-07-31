# SB-20260731-141327-task3-controller-diagnostic-select-object-syntax: Controller diagnostic used invalid PowerShell selection syntax

- **Status:** closed
- **First observed:** 2026-07-31T14:13:27.7058052Z
- **Last observed:** 2026-07-31T14:22:09.9238204Z
- **Phase/task:** Phase B Task 3 concrete observer-port integration
- **Environment:** Main Phase B worktree; focused controller diagnostic
- **Version/commit:** c5de12d plus unstaged controller and resolver repairs

## Symptom

A read-only diagnostic used an invalid PowerShell selection token and stopped
before producing the intended bounded classification.

## Impact

Root-cause localization for the one remaining focused controller failure
paused. The focused state remains 50 passing tests and one failing test.

## Reproduction conditions

Use the invalid selection token in a PowerShell diagnostic rather than the
supported `Select-Object` cmdlet form.

## Safe evidence

The writer returned only the fixed error category and aggregate test counts.
No source, argument payload, URI, credential, protected identifier, provider
value, runtime stream, or environment value was emitted.

## Attempts and outcomes

- The diagnostic exited before any useful classification.
- No repository, Git, provider, or external state changed.

## Cause classification

- **Confirmed cause:** The diagnostic used invalid PowerShell cmdlet syntax.
- **Hypotheses:** The remaining product-test failure still requires bounded
  localization.
- **Rejected hypotheses:** No permission, provider, or repository failure was
  implicated.
- **Known exclusions:** The resolver lane remains green and unchanged.

## Correction and prevention

- **Correction:** Use supported PowerShell selection syntax and emit only one
  fixed failure-state category.
- **Prevention:** Keep diagnostic pipelines to previously validated cmdlets
  and avoid improvised aliases or token forms.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Classify the remaining late-signal/slow-closure
  failure without emitting runner or source payload.

## Verification and related work

Validated bounded diagnostics localized the suite-load issue and the remaining
runtime scenario without another invalid selector or prohibited output.

## Recurrence history

- 2026-07-31T14:13:27.7058052Z: First observed and contained with zero state
  change.
- 2026-07-31T14:22:09.9238204Z: Closed after compatible bounded diagnostics
  completed without recurrence.
