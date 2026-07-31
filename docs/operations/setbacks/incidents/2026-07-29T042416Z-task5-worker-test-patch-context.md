# SB-20260729-042416-task5-worker-test-patch-context: Worker test patch context was stale

- **Status:** closed
- **First observed:** 2026-07-29T04:24:16.3267175Z
- **Last observed:** 2026-07-30T20:53:12.3702257Z
- **Phase/task:** Phase B live-acceptance closure Task 1
- **Environment:** Local Phase B worktree
- **Version/commit:** Uncommitted wave-2 fixes based on `41d3e74`

## Symptom

The first patch for the activation-source Worker tests expected a nearby test
name and assertion layout that did not match the current file.

## Impact

The patch was rejected before changing the test file. No runtime, provider, or
external state changed.

## Cause classification

- **Confirmed cause:** The patch anchor was inferred instead of copied from the
  current file.
- **Hypotheses:** None.
- **Rejected hypotheses:** Concurrent modification.
- **Known exclusions:** The intended Worker tests were not partially applied.

## Correction and prevention

- **Correction:** Re-read the local wrong-owner test block and applied the
  change against exact current context.
- **Prevention:** Copy the immediate insertion anchor from the current file
  before applying a late-stage patch.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected patch applied cleanly. Focused Worker verification follows before
the final complete gate.

## Recurrence history

- 2026-07-29T04:31:37.7684282Z: Recurred when the Git-staging incident close
  patch expected a verification section that had not yet been created. The
  patch was rejected before mutation; the incident was re-read and updated
  against exact current context.
- 2026-07-29T22:17:29.4606218Z: A combined workflow regression patch expected
  surrounding assertions that differed from the current file. The patch was
  rejected atomically before mutation; the correction is to use smaller
  patches copied from current local context.
- 2026-07-29T22:50:43.9725689Z: A combined AI environment-fixture patch
  assumed the wrong stale Gateway-limit case while updating exact pricing
  values. The patch was rejected atomically; the correction uses the current
  bounded section and smaller hunks.
- 2026-07-29T23:03:52.7596594Z: A combined workflow lifetime-test patch used
  an assertion line from an adjacent test block as shared context. The patch
  was rejected atomically; the correction targets each current assertion
  independently.
- 2026-07-29T23:16:32.5931857Z: A combined reference-document patch reused
  the technical domain document's introduction as context for the simple
  document. The patch was rejected atomically; the correction uses independent
  exact-file hunks.
- 2026-07-29T23:51:26.1763604Z: The ignored report append copied a prior
  UTF-8 dash through the default PowerShell decoding and therefore missed the
  exact final-line context. The patch was rejected atomically; the correction
  reads the boundary explicitly as UTF-8.
- 2026-07-30T19:20:09.0786632Z: A combined Task 1 workflow replacement used
  an inferred environment-variable name for one observer field. The patch was
  rejected atomically before mutation; the correction uses smaller exact
  replacements from bounded input-reference inspection.
- 2026-07-30T19:20:38.9747919Z: A second combined replacement retained one
  inferred lifecycle environment name and was also rejected atomically. The
  correction now uses literal one-line substitutions only.
- 2026-07-30T20:53:12.3702257Z: A Task 3 domain-test patch guessed a describe
  label that differs from the current file. The hunk was rejected atomically
  and changed no file; the retry uses symbol-only current context.
