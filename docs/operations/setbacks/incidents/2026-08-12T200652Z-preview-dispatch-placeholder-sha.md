# SB-20260812-200652 - Preview workflow dispatched with an incorrect reviewed SHA

- **Status:** contained
- **Detected:** 2026-08-12T20:06:52.845Z
- **Last observed:** 2026-08-12T20:07:05Z
- **Area:** Phase B preview release dispatch
- **Evidence:** The normal preview workflow was dispatched with a placeholder
  reviewed commit instead of the exact branch tip. The actual local tip is
  resolved separately from the repository; the workflow's admission contract
  requires the context commit to equal the checked-out dispatch SHA.
- **Impact:** The run failed in `Admit one preview operation`; all deployment,
  candidate, observer, and rollback jobs were skipped. No secret, database, R2,
  Queue, Worker configuration, deployment, or traffic state changed.
- **Correction:** Verified the run failed in selection before retrying.
  Generate the context commit only from `git rev-parse HEAD`, validate its
  40-character shape, and compare it to `git ls-remote` immediately before
  dispatch.
- **Prevention:** Never hand-construct or abbreviate a reviewed SHA in an
  external workflow context; use one captured command result and a local
  equality check.
