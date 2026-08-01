# SB-20260731-202446-task4-domain-reference-patch-context: Task 4 domain reference patch assumed shared prose

- **Status:** closed
- **First observed:** 2026-07-31T20:24:46.884785Z
- **Last observed:** 2026-07-31T23:05:19.9065756Z
- **Phase/task:** Phase B Task 4 deterministic references
- **Environment:** Local Phase B worktree reference pages
- **Version/commit:** c23e301 plus Task 4 working changes

## Symptom

A combined simple and technical reference patch assumed both pages used the same nearby sentence; verification rejected the patch before any page changed.

## Impact

No partial documentation change occurred; reference updates are delayed until exact page-local append points are used.

## Reproduction conditions

Apply one combined patch against assumed shared prose across independently maintained simple and technical pages.

## Safe evidence

Patch verification rejected each mismatched combined edit before applying partial changes. Exact page-local edits then completed, and documentation coverage passed.

## Attempts and outcomes

- Switched domain and prepare-script additions to exact page-end anchors.
- Updated controller and validator pages independently against current prose.

## Cause classification

- **Confirmed cause:** Simple and technical reference pages intentionally use different explanatory prose and cannot share inferred patch context.
- **Hypotheses:** None active.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** Source behavior and previously verified tests were unaffected.

## Correction and prevention

- **Correction:** Applied each reference edit using exact page-local context.
- **Prevention:** Do not combine simple/technical reference patches unless each exact anchor has been read.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; incident closed.

## Verification and related work

Fresh `docs:check` exited zero after all eight matching reference pages were updated.

## Recurrence history

- 2026-07-31T20:24:46.884785Z: First observed.
- 2026-07-31T20:25:47.4791890Z: Recurred when a combined four-source reference
  patch assumed exact end prose for the prepare script. No partial patch was
  applied; remaining edits use exact headings or page-end append points.
- 2026-07-31T20:27:06.9147214Z: Recurred when a combined validator reference
  patch assumed shared simple/technical prose. No partial patch was applied;
  the pages are now edited independently against exact current sentences.
- 2026-07-31T20:28:29.9636612Z: Closed after page-local edits and a successful documentation coverage gate.
- 2026-07-31T20:44:09.0860921Z: Recurred when one combined workflow/window
  implementation patch assumed the schedule-helper call appeared after its
  definition. Patch verification rejected the whole patch with no partial
  source change; correction is to patch each verified local range separately.
- 2026-07-31T20:47:11.4436106Z: Recurred when a new incident-file patch had
  one malformed added-file line. Patch verification rejected the whole patch;
  the corrected patch prefixes every added line explicitly.
- 2026-07-31T20:50:37.5421139Z: Closed after file-local source/reference
  patches, documentation coverage, and owned diff checks all exited zero.
- 2026-07-31T21:47:31.0672274Z: Recurred when a setback-ledger update assumed
  the final prose line was inside the recurrence section. Patch verification
  rejected the whole patch; correction uses separate exact header, recurrence,
  and index edits.
- 2026-07-31T22:22:02.6141163Z: Recurred when a combined reviewer-setback
  ledger patch used an index-row context that failed verification. The patch
  was rejected atomically; correction splits incident and index edits against
  freshly read exact rows.
- 2026-07-31T23:02:40.6283546Z: Recurred when a Task 6 R2 review ledger patch
  assumed the cleanup lane's truncation timestamp before reading its concurrent
  update. The patch was rejected atomically; correction uses the exact current
  header and separate incident creation.
- 2026-07-31T23:05:19.9065756Z: Recurred when the safe-runner repair attempted
  to patch a Task 6 path-assumption index row that concurrent ledger edits had
  changed. The patch was rejected without source impact; that lane no longer
  edits shared setback records during repair.
