# SB-20260812-200850 - Workflow context quotes were stripped by the dispatch wrapper

- **Status:** contained
- **Detected:** 2026-08-12T20:08:50Z
- **Last observed:** 2026-08-12T20:08:51Z
- **Area:** Phase B preview release dispatch
- **Evidence:** The correctly pinned workflow run failed in the admission job.
  Its safe log projection showed `ACCEPTANCE_CONTEXT` arriving as
  `{version:vision.preview-acceptance-context/v2,kind:none,...}` rather than
  the canonical quoted JSON string. The SHA and checked-out SHA matched the
  reviewed branch tip.
- **Impact:** The validator failed closed before any repository checks,
  deployment, candidate, observer, rollback, secret, database, R2, Queue, or
  Worker configuration action ran.
- **Correction:** Use GitHub CLI raw-field input for the JSON context, and
  locally serialize it through `serializePreviewAcceptanceContext` before
  dispatch. Do not use the typed field form for byte-sensitive JSON.
- **Prevention:** For every workflow input that is canonical JSON, compare the
  locally generated string with a safe JSON parse and send it with the raw
  field transport; verify the admission job before any retry.
