# SB-20260727-024307-task-brief-included-prior-tasks: Generated task briefs included prior tasks

- **Status:** closed
- **First observed:** 2026-07-27T02:43:07Z
- **Last observed:** 2026-07-27T02:43:07Z
- **Phase/task:** Phase B restore planning
- **Environment:** Local ignored scratch workspace
- **Version/commit:** `574ea0a`

## Symptom

The first PowerShell fallback extraction for Tasks 2 through 4 included the
global constraints plus every preceding task.

## Impact

No brief was dispatched. The ignored scratch files were overwritten
immediately with one task plus the global constraints.

## Reproduction conditions

Use the selected task's heading, rather than Task 1's heading, as the end of
the global-constraints slice.

## Safe evidence

Initial line counts grew with task number. The corrected files each contain
exactly one task heading.

## Attempts and outcomes

- Initial future-task brief generation over-included prior tasks.
- The validation count exposed the error before dispatch.
- Corrected generation produced one task heading per brief.

## Cause classification

- **Confirmed cause:** The global prefix end boundary was calculated from the
  selected task instead of the first task.
- **Hypotheses:** None.
- **Rejected hypotheses:** The implementation plan headings were not
  malformed.
- **Known exclusions:** No tracked or provider state changed.

## Correction and prevention

- **Correction:** End the shared global prefix immediately before Task 1 and
  append only the selected task range.
- **Prevention:** Require exactly one task heading in every generated brief
  before dispatch.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

Tasks 2 through 4 each have a validated ignored brief containing one task
heading.

## Recurrence history

- 2026-07-27T02:43:07Z: First observed and corrected before dispatch.
