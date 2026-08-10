# SB-20260729-200952-setback-note-patch-context

- **Status:** closed
- **Last observed:** 2026-08-02T22:30:21.2575983Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 through OAuth reconnect Task 5 artifact verification closeout
- **Title:** Setback-note patch used stale prevention wording
- **Impact:** Six patches were rejected before making changes: one documentation-only patch, one production workflow patch, and four incident closeout patches.
- **Cause:** The first two assumed trailing context that differed from the current files, two omitted a file header, one assumed status fields were adjacent, and one ordered index hunks backwards.
- **Resolution:** Used safe structural reads, narrow replacements, and explicit file boundaries for every subsequent patch.
- **Recurrence:** Recurred five times during the implementation pass.
- **Recurrence:** A wave-4 multi-file recurrence update assumed two setback
  index rows were adjacent. The patch was rejected atomically before mutation;
  the correction uses one exact hunk per current row.
- **Recurrence:** Two Gate 0 warning-recurrence patches used repeated trailing
  paragraphs as multi-file anchors. Both were rejected atomically before
  mutation. The correction uses one file and one unique timestamp anchor per
  patch.
- **Recurrence:** A third insertion assumed the final repeated verification
  paragraph could be stabilized with an end-of-file marker; the mixed-line
  working copy still rejected it atomically. The correction records the
  recurrence beside unique header metadata instead.
- **Recurrence:** The OAuth reconnect blocked-state update assumed a wrapped
  approval-incident sentence that no longer matched the file exactly. The
  multi-file patch was rejected atomically before any change. The correction
  uses the current timestamp field and recurrence-list tail as separate narrow
  anchors, then updates the ignored progress ledger independently.
- **Recurrence:** The artifact-verification closeout patch assumed status and
  last-observed fields appeared in the same order across incident templates.
  The multi-file patch was rejected atomically before any change. The
  correction uses one file and one exact current-field hunk at a time.
- **Recurrence:** The offline-install and provider-output recurrence patch
  ordered two exact index hunks opposite their physical file order. The patch
  was rejected atomically before mutation. Remaining ledger updates use one
  index row per patch.
- **Recurrence:** The candidate-helper validator closeout guessed the
  helper-generated microsecond timestamp instead of reading the created file.
  The patch was rejected atomically before mutation. The correction uses the
  exact generated header and index row just read from disk.
