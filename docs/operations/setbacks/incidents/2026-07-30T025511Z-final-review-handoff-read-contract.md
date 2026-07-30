# SB-20260730-025511-final-review-handoff-read-contract: Final review handoff blocked its own file reads

- **Status:** closed
- **First observed:** 2026-07-30T02:55:11.7230018Z
- **Last observed:** 2026-07-30T02:55:11.7230018Z
- **Phase/task:** Phase B acceptance instrumentation formal final review
- **Environment:** Local Codex reviewer agents
- **Version/commit:** `840ebd1`

## Symptom

The controller's first formal-review instruction prohibited all shell commands
even though the reviewer exposed local text only through bounded PowerShell
reads. After that restriction was corrected, the Task 7 reviewer inferred a
nonexistent final-fix report filename because the exact report path was not
listed in that follow-up.

## Impact

Both attempts stopped before substantive package review. No package, source,
index, branch, provider, or private state changed. The formal reviews were
delayed but not weakened.

## Reproduction conditions

Dispatch a local static reviewer without authorizing its only bounded text-read
mechanism, or refer to a report by description without its exact existing path.

## Safe evidence

The reviewer reported an unavailable local-text access route, then a
file-not-found category for the inferred report filename. Neither attempt
rendered source content or a private value.

## Attempts and outcomes

- The over-restrictive first handoff stopped before opening the package.
- A bounded read-only `Get-Content` exception was authorized.
- The reviewer then stopped on an inferred report path before package review.
- The controller supplied the complete exact input-path list, and both formal
  reviewers completed static review.

## Cause classification

- **Confirmed cause:** The reviewer handoff did not match the tools actually
  available to that agent and did not enumerate every required file path.
- **Hypotheses:** None.
- **Rejected hypotheses:** Missing review artifacts or repository corruption.
- **Known exclusions:** No tracked mutation, provider access, credential
  exposure, test execution, or external action occurred during either stop.

## Correction and prevention

- **Correction:** Authorize bounded read-only `Get-Content` for named files and
  provide every exact package, report, brief, plan, and prior-review path.
- **Prevention:** Before dispatch, verify the reviewer's available local-read
  mechanism and use an explicit input manifest rather than descriptive
  filenames.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

Both formal reviewers read the exact frozen package and returned zero Critical,
zero Important, and zero Minor findings. The whole-branch reviewer marked the
branch ready for guarded live acceptance, subject to the separate owner wording
conflict.

## Recurrence history

- 2026-07-30T02:55:11.7230018Z: First observed, contained, corrected, and
  verified through completed formal reviews.
