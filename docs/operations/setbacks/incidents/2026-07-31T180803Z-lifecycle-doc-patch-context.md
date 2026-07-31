# SB-20260731-180803-lifecycle-doc-patch-context: Lifecycle reference patch missed technical prose wrapping

- **Status:** closed
- **First observed:** 2026-07-31T18:08:03.5364814Z
- **Last observed:** 2026-07-31T18:08:03.5364814Z
- **Phase/task:** Phase B Task 3 fourth-wave lifecycle repair
- **Environment:** Local documentation edit
- **Version/commit:** 91a9cf9 plus green lifecycle/workflow edits

## Symptom

A combined documentation patch expected different wrapping in one technical
reference sentence, so `apply_patch` rejected the patch atomically.

## Impact

No reference file changed. The lifecycle, provider, workflow, and TypeScript
checks completed before this point remain green. No provider, environment,
network, secret, staging, or commit was touched.

## Cause classification

- **Confirmed cause:** The combined patch relied on prose context that did not
  exactly match the current technical reference.
- **Hypotheses:** None remaining.
- **Known exclusions:** No partial documentation edit occurred.

## Correction and prevention

- **Correction:** Read bounded current excerpts and patch each reference with
  smaller exact context, then rerun documentation coverage.
- **Prevention:** Split multi-reference prose edits when line wrapping differs
  between simple and technical documentation.
- **Owner:** Codex.
- **Next diagnostic step:** None; the correction is exact.

## Recurrence history

- 2026-07-31T18:08:03.5364814Z: Observed, contained, and closed before any
  reference-file change.
