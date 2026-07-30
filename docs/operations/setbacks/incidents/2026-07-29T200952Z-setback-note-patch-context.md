# SB-20260729-200952-setback-note-patch-context

- **Status:** closed
- **Last observed:** 2026-07-30T01:28:56.5986795Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 4
- **Title:** Setback-note patch used stale prevention wording
- **Impact:** Six patches were rejected before making changes: one documentation-only patch, one production workflow patch, and four incident closeout patches.
- **Cause:** The first two assumed trailing context that differed from the current files, two omitted a file header, one assumed status fields were adjacent, and one ordered index hunks backwards.
- **Resolution:** Used safe structural reads, narrow replacements, and explicit file boundaries for every subsequent patch.
- **Recurrence:** Recurred five times during the implementation pass.
- **Recurrence:** A wave-4 multi-file recurrence update assumed two setback
  index rows were adjacent. The patch was rejected atomically before mutation;
  the correction uses one exact hunk per current row.
