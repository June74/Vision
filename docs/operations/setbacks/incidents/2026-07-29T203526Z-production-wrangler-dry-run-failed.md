# SB-20260729-203526-production-wrangler-dry-run-failed

- **Status:** closed
- **Last observed:** 2026-07-29T20:39:17Z
- **Phase/task:** Phase B consolidated final-fix production-path verification
- **Title:** Explicit production Wrangler dry-run failed after artifact validation
- **Impact:** The production build and local artifact validator passed, but the non-mutating Wrangler dry-run exited nonzero. No deployment, provider mutation, or external state change occurred.
- **Cause:** The Windows package runner did not resolve Wrangler, and direct invocation inside the sandbox could not access Wrangler's required filesystem paths. The generated artifact was not defective.
- **Resolution:** Kept the workflow's Linux package-runner command and ran the installed Wrangler binary outside the sandbox with its debug log directed to the workspace. The explicit production dry-run passed.
- **Recurrence:** Recurred under direct invocation after bypassing the Windows package-runner issue; a later path classifier was abandoned after rejecting the escaped log value.
