# SB-20260801-193303-task7-correlation-task3-review-findings: Correlation Task 3 review found three regression gaps

- **Status:** closed
- **First observed:** 2026-08-01T19:33:03.617944Z
- **Last observed:** 2026-08-01T20:14:45.6641160Z
- **Phase/task:** Phase B Task 7 correlation repair Task 3 review
- **Environment:** To be established
- **Version/commit:** To be established

## Symptom

The first independent review found omitted observer-job reachability coverage, upload counting tied to one label, and no behavioral subprocess tests for the file verifier boundary. After those corrections, the final re-review found three further gaps: the bounded reader did not guarantee complete reads or strict UTF-8 rejection, workflow mutations did not cover every required name/retention/global-duplicate case, and subprocess tests did not substitute a separately valid evidence file from another binding.

## Impact

Task 3 remains unaccepted and Task 4 is paused. Focused tests and typecheck were green but did not cover these adversarial boundaries. No live/provider, secret, deployment, or commit state changed.

## Reproduction conditions

Re-review the Task 3-only frozen diff against every approved workflow mutation and file-verifier adversarial boundary after the focused suite passes.

## Safe evidence

Fresh read-only review reported zero Critical, three Important, and zero Minor findings. The report used repository-relative code locations and safe defect categories only.
After correction, the focused suite passed 56 tests, typecheck passed, the frozen diff privacy scan had zero prohibited-pattern matches, and a new independent review returned zero findings at every severity.

## Attempts and outcomes

- Added AI-uniqueness reachability, pinned-action upload counting, alternate-label duplicate mutation, and behavioral subprocess tests; the focused suite passed 55 tests and typecheck passed.
- Froze and privacy-scanned the Task 3-only diff; URL, email, and literal 64-hex counts were all zero.
- Fresh independent re-review still failed with three Important findings, so acceptance remained closed.
- The first follow-up RED reported two failures, but inspection proved the upload failure came from an over-broad test helper that counted every pinned upload action rather than only correlation-artifact uploads.
- The corrected RED failed only the strict reader boundary. Minimal implementation produced 56 passing focused tests and a passing typecheck.
- A fresh frozen-diff review returned 0 Critical, 0 Important, and 0 Minor findings.

## Cause classification

- **Confirmed cause:** The first correction covered the literal findings but did not enumerate the deeper adversarial variants required by the approved contract. The reader implementation also relied on a single non-fatal UTF-8 read. The follow-up parsed-workflow helper incorrectly required only one pinned upload action globally even though the workflow has five legitimate pinned uploads for distinct safety artifacts.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The committed workflow has a global upload-action uniqueness defect. Inspection proved its five pinned upload steps have distinct approved safety-artifact bindings, with only one dispatch-correlation upload.
- **Known exclusions:** No private output, live/provider action, secret access, deployment, commit, or backup-key change occurred.

## Correction and prevention

- **Correction:** Global uniqueness now counts only fixed correlation-artifact claimants across every job; name, path, retention, action, and cross-job duplicate mutations are covered. The verifier now performs repeated bounded reads with fatal UTF-8 decoding, and tests substitute a separately valid cross-binding evidence file.
- **Prevention:** Final reviews enumerate adversarial variants rather than accept category-level test names; file-boundary tests distinguish malformed artifacts from valid artifacts bound to a different transaction; workflow uniqueness predicates distinguish correlation claims from unrelated approved safety artifacts.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Proceed to the approved exact rollback-proof-chain task.

## Verification and related work

Final verification: 56 focused tests passed, canonical typecheck passed, the Task 3 frozen diff passed the privacy-pattern scan, and fresh independent review returned zero Critical, Important, or Minor findings.

## Recurrence history

- 2026-08-01T19:33:03.617944Z: First observed.
- 2026-08-01T20:00:43.4537925Z: Recurred after the first correction; a fresh final review found three additional Important adversarial gaps. Task 3 remained contained and unaccepted.
- 2026-08-01T20:05:22.2251986Z: The first follow-up RED exposed an over-broad global upload-action test helper; the false workflow-defect hypothesis was rejected before any workflow or production edit.
- 2026-08-01T20:14:45.6641160Z: Corrected reader, mutation, and cross-binding coverage passed focused verification and a fresh zero-finding review; incident closed.
