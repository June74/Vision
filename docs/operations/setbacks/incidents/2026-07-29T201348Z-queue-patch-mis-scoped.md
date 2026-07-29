# SB-20260729-201348-queue-patch-mis-scoped

- **Status:** closed
- **Last observed:** 2026-07-29T20:13:48Z
- **Phase/task:** Phase B consolidated final-fix queue isolation
- **Title:** Queue-name patch matched the root block instead of production
- **Impact:** The local root queue name was briefly changed in the working tree. The error was detected before tests, staging, deployment, or any external mutation.
- **Cause:** The first patch used two queue lines shared by root, preview, and production without an environment-specific context.
- **Resolution:** Restored the root block and changed only the production block using the enclosing production environment context.
- **Recurrence:** First observation in this task.
