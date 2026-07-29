# SB-20260729-203801-dry-run-path-classifier-invalid

- **Status:** closed
- **Last observed:** 2026-07-29T20:38:01Z
- **Phase/task:** Phase B consolidated final-fix dry-run diagnosis
- **Title:** Escaped dry-run path was invalid for a local existence check
- **Impact:** A read-only classifier threw while checking an escaped log value and the shell error rendered a partial local workspace path. No credential, provider value, file, or external state changed.
- **Cause:** The diagnostic passed an escaped, terminal-formatted path directly to the filesystem API.
- **Resolution:** Stop parsing captured path strings and rerun the non-mutating dry-run outside the sandbox with a workspace-owned log path.
- **Recurrence:** First observation in this task.
