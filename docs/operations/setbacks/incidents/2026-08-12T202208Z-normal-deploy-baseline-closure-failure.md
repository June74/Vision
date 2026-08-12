# SB-20260812-202208 - Normal preview deployment admission rejected baseline closure

- **Status:** contained
- **Detected:** 2026-08-12T20:20:25.968Z
- **Last observed:** 2026-08-12T20:22:08.010Z
- **Area:** Phase B normal preview release admission
- **Evidence:** The argv-preserving dispatch passed selection and all
  application/browser verification checks. The `Deploy normal preview` job
  stopped in `Verify normal deploy lifecycle admission` with the safe message
  `Preview rollback lifecycle proof is invalid.` The deployment step was
  skipped.
- **Impact:** No Cloudflare deployment, traffic change, rollback, database,
  R2, Queue, credential, or Worker configuration state changed. The reviewed
  code remains unpublished.
- **Resolution:** The workflow always queried the retained
  `vision-preview-candidate-intent` artifacts before branching on the explicit
  `baseline` selection. Because old candidate artifacts still existed, the
  latest-candidate validator returned a numeric run and rejected the otherwise
  valid baseline closure. The workflow now performs candidate-artifact lookup
  and `--verify-latest-candidate` only for non-baseline runs; baseline still
  requires `ROLLBACK_CLOSURE_RUN_ID=baseline` and validates a null closure.
  A workflow contract regression covers this branch, and the focused workflow,
  YAML, lifecycle, TypeScript, and diff checks pass. No provider state changed.
- **Next action:** Re-dispatch one normal preview release from the final pushed
  commit and inspect the safe deployment result.
