# SB-20260729-202801-reference-list-pipeline-early-close

- **Status:** closed
- **Last observed:** 2026-07-29T20:28:01Z
- **Phase/task:** Phase B consolidated final-fix documentation discovery
- **Title:** Reference listing pipeline exited after an early output cutoff
- **Impact:** The read-only command returned enough paths but reported a nonzero exit. No file or external state changed.
- **Cause:** The first-item limiter closed the native Git output pipeline before Git completed.
- **Resolution:** Use exact known reference paths directly and avoid early-closing native command pipelines.
- **Recurrence:** First observation in this task.
