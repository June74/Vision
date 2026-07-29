# SB-20260729-173449-task6-doc-patch-context: Combined documentation patch used stale evidence context

- **Status:** closed
- **First observed:** 2026-07-29T17:34:49Z
- **Last observed:** 2026-07-29T18:16:52Z
- **Phase/task:** Phase B acceptance instrumentation Task 6 review fixes
- **Environment:** Local Phase B linked worktree
- **Version/commit:** `fa650ad`

## Symptom

A combined documentation patch could not find one expected paragraph in the
Phase B evidence ledger.

## Impact

The patch was rejected atomically and no documentation file changed on that
attempt. No provider, database, browser, runtime, or external state changed.

## Reproduction conditions and safe evidence

The patch expected an earlier Task 8 paragraph, while the current ledger uses a
shorter source-cleanup paragraph with different line wrapping.

## Attempts and outcomes

- The combined patch failed before applying any hunk.
- The current evidence section was read directly and its exact text confirmed.

## Cause classification

- **Confirmed cause:** The patch context did not match the current ledger.
- **Hypotheses:** None.
- **Known exclusions:** No partial documentation edit occurred.

## Correction and prevention

- **Correction:** Apply smaller file-specific patches against exact current
  context.
- **Prevention:** Inspect volatile evidence-ledger sections immediately before
  patching them.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

Documentation checks will run after the smaller patches are applied.

## Recurrence history

- 2026-07-29T18:16:52Z: A final re-review cleanup-test refactor expected a
  conventional closing-parenthesis indentation, but the current block retained
  an older offset layout. The multi-hunk patch applied nothing. The correction
  is to patch the exact numbered source block; no detector behavior or test
  result was affected.
