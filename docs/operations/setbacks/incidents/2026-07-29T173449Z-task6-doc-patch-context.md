# SB-20260729-173449-task6-doc-patch-context: Combined documentation patch used stale evidence context

- **Status:** closed
- **First observed:** 2026-07-29T17:34:49Z
- **Last observed:** 2026-07-31T23:22:58.9808554Z
- **Phase/task:** Phase B acceptance instrumentation and live-closure Task 6
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
- 2026-07-31T22:53:24.8736227Z: A live-closure Task 6 multi-file documentation
  patch joined two file contexts incorrectly and was rejected atomically. No
  documentation changed; the correction is one exact file-specific patch at a
  time.
- 2026-07-31T22:55:16.3646473Z: The first supersession-note patch generated a
  malformed footer and was rejected before applying. No file changed; the
  correction is a handwritten patch block with an exact footer.
- 2026-07-31T23:04:17.1985061Z: The inventory documentation patch expected an
  unwrapped helper signature and was rejected atomically after formatting had
  changed the context. No file changed; the retry uses exact symbol lines.
- 2026-07-31T23:22:58.9808554Z: The R2 causal-state repair combined a later
  hunk with context changed by its preceding edit. The patch was rejected
  atomically with no partial mutation or sensitive output. The repair resumes
  with one current symbol-bounded hunk at a time.
