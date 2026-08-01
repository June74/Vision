# SB-20260729-051117-task6-green-test-assumptions: GREEN tests encoded two incorrect assumptions

- **Status:** closed
- **First observed:** 2026-07-29T05:10:00Z
- **Last observed:** 2026-07-31T23:41:05.3867414Z
- **Phase/task:** Phase B acceptance instrumentation and live-closure Task 6 GREEN
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

## Recurrence history

- 2026-07-31T22:56:23.2062860Z: The live-closure cleanup GREEN retained a
  60-path count, the pre-amendment shared list, and a top-level operations list
  that predated the Phase C skeleton. Its broad residue scan also treated new
  permanent/unowned paths as shared residue. Closure tests passed; no runtime or
  external state changed. The correction derives assertions and scan exclusions
  from the single reviewed classification map.
- 2026-07-31T22:58:41.1522481Z: The second GREEN showed the frozen shared block
  contains 51 paths rather than the stale 52 count and exposed four older
  acceptance-only tests not yet assigned a disposition. No runtime or external
  state changed. The correction classifies those tests for dedicated deletion
  and derives uniqueness from the map rather than an obsolete count.
- 2026-07-31T23:02:06.0770674Z: The CLI GREEN used a Vitest `it.each` row that
  treated an empty array as zero arguments, so the helper received `undefined`.
  No product or external state changed. The correction uses explicit object
  rows so every invalid argument array is passed as one value.
- 2026-07-31T23:21:47.1246702Z: Independent cleanup review found the supposedly
  exhaustive map assertion was self-referential and did not prove an
  independent Task 1-8 universe or exact retained projections. It also found
  non-strict residue checking accepted only 38 of 51 shared paths, allowing a
  strict run to omit reviewed Task 9 residue. Task 6 remains open for focused
  RED/GREEN repair and re-review; no live or provider state changed.
- 2026-07-31T23:32:18.6142953Z: Re-review accepted the independent 184-entry
  fingerprint proof but found non-strict residue equality was manufactured by
  unioning the 51 expected paths into the 38 actually detected paths. The
  tautological branch is returned for a detector-backed repair; Task 6 remains
  open and no external state changed.
- 2026-07-31T23:41:05.3867414Z: Closed after the detector returned only actual
  residue and proved all 51 reviewed shared paths through literal marker or
  content-fingerprint contracts. Adversarial mutation removed each of the 13
  formerly missing detections, 21 focused tests passed, strict mode failed only
  the exact three reviewed assertions, and independent re-review returned
  `NO_BLOCKERS`.
