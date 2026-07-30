# SB-20260729-203526-production-wrangler-dry-run-failed

- **Status:** contained
- **Last observed:** 2026-07-30T00:44:57.6603899Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 3
- **Title:** Explicit Wrangler dry-run failed inside the local sandbox
- **Impact:** The production build and local artifact validator passed, but the non-mutating Wrangler dry-run exited nonzero. No deployment, provider mutation, or external state change occurred.
- **Cause:** The Windows package runner did not resolve Wrangler, and direct invocation inside the sandbox could not access Wrangler's required filesystem paths. The generated artifact was not defective.
- **Resolution:** Kept the workflow's Linux package-runner command and ran the installed Wrangler binary outside the sandbox with its debug log directed to the workspace. The explicit production dry-run passed.
- **Recurrence:** Recurred under direct invocation after bypassing the Windows package-runner issue; a later path classifier was abandoned after rejecting the escaped log value. At 2026-07-29T23:29:30.7979412Z, the same direct invocation failed for the validated preview artifact because Wrangler could not write its user-profile log or traverse the built entry-point path inside the sandbox. The explicitly approved unsandboxed `--dry-run` retry returned exit zero; no deployment or provider mutation occurred.
- **Wave-3 recurrence:** At 2026-07-30T00:44:57.6603899Z, the requested
  local preview dry-run was denied before execution because an unsandboxed
  Wrangler command could egress the built artifact. The denial forbids retries
  or alternate routing. No process, network, deployment, provider, source, or
  private state changed. The current preview build, exact artifact validator,
  pricing attestation, all eight generated-candidate checks, and workflow
  contract passed; preview and production dry-runs remain intentionally
  unexecuted in wave 3.
