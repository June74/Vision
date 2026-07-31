# SB-20260731-175211-timing-doc-patch-context: Timing reference patch missed the current line wrapping

- **Status:** closed
- **First observed:** 2026-07-31T17:52:11.5500926Z
- **Last observed:** 2026-07-31T17:52:11.5500926Z
- **Phase/task:** Phase B Task 3 fourth-wave timing repair
- **Environment:** Local documentation edit
- **Version/commit:** 57587fb plus green timing source/test edits

## Symptom

The documentation patch expected different sentence wrapping in the simple
controller reference, so `apply_patch` rejected the multi-file patch
atomically.

## Impact

Neither reference document changed. The 46-minute controller source and its
59 passing focused tests remain intact. No provider, environment, network,
secret, staging, or commit was touched.

## Cause classification

- **Confirmed cause:** The patch used stale wrapping context instead of a
  smaller exact excerpt from the current files.
- **Hypotheses:** None remaining.
- **Known exclusions:** No partial documentation edit occurred because the
  patch was atomic.

## Correction and prevention

- **Correction:** Inspect bounded exact excerpts and apply smaller patches to
  each verified reference independently.
- **Prevention:** Use exact current context for prose files whose wrapping may
  differ from expected text.
- **Owner:** Codex.
- **Next diagnostic step:** None; the correction is known.

## Recurrence history

- 2026-07-31T17:52:11.5500926Z: Observed, contained, and closed before any
  documentation change.
