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
- **Correction:** The follow-up raw-field retry showed that the higher-level
  `gh workflow run` command still stripped JSON punctuation. Use the repository
  driver's direct GitHub REST dispatch path, which sends the canonical string as
  one form field, and locally serialize it through
  `serializePreviewAcceptanceContext` before dispatch.
- **Prevention:** Do not use `gh workflow run` for byte-sensitive JSON inputs.
  Compare the locally generated string with a safe JSON parse, send it through
  the direct API transport, and verify the admission job before any retry.

## Recurrence

At 2026-08-12T20:11:12Z, the raw-field form failed with the same safe symptom;
the run again stopped in admission and all deployment/traffic jobs were
skipped. No provider or runtime state changed.
