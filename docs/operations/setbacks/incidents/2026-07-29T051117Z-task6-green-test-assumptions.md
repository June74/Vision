# SB-20260729-051117-task6-green-test-assumptions: GREEN tests encoded two incorrect assumptions

- **Status:** closed
- **First observed:** 2026-07-29T05:10:00Z
- **Last observed:** 2026-07-29T05:11:17Z
- **Phase/task:** Phase B acceptance instrumentation Task 6 GREEN
- **Environment:** Local Phase B linked worktree
- **Version/commit:** `1c7f89b`

## Symptom

The first focused GREEN run retained two failures caused by the new test code:
the cleanup test rejected the approved deletion of one failed backup object, and
the workflow choice parser omitted `r2_upload_failed`.

## Impact

Two intended-green assertions failed for reasons unrelated to the Task 6
runtime behavior. No runtime, provider, database, browser, or network state
changed.

## Reproduction conditions and safe evidence

The cleanup assertion searched for every `.delete(` call even though the normal
backup path deliberately deletes its own newly written object after a failed
verification. The workflow helper accepted only lowercase letters and
underscores, so it could not parse a valid choice containing the digit `2`.

## Attempts and outcomes

- The focused Task 6 suite exposed both assumptions.
- Source inspection confirmed the backup delete is scoped to `objectKey`, not
  the backup prefix or provider collection.
- The frozen Task 6 fault vocabulary confirms `r2_upload_failed` is required.
- The first record patch assumed obsolete index headings; it made no change,
  and the exact current headings were used on retry.

## Cause classification

- **Confirmed cause:** The cleanup assertion was broader than the deletion
  policy, and the test helper's character class was narrower than the approved
  fault vocabulary.
- **Hypotheses:** None.
- **Rejected hypotheses:** The production backup cleanup and frozen fault tuple
  are not defects.
- **Known exclusions:** No live state or approved evidence schema changed.

## Correction and prevention

- **Correction:** Preserve and assert the scoped per-object cleanup while
  rejecting broad prefix deletion; allow digits in workflow choice parsing.
- **Prevention:** Encode the exact prohibited action rather than a method-name
  substring, derive test parsers from the complete frozen vocabulary, and read
  the current index header before patching it.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The focused Task 6 suite will be rerun after the corrections.
