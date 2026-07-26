# SB-20260726-222601-tail-job-inserted-inside-deploy-step: Tail job inserted inside deploy step

- **Status:** closed
- **First observed:** 2026-07-26T22:26:01Z
- **Last observed:** 2026-07-26T22:26:01Z
- **Phase/task:** Phase B privacy-safe live diagnostics
- **Environment:** Local GitHub workflow edit
- **Version/commit:** `d4a2ae5`

## Symptom

The first patch anchored on an environment block inside the preview
authorization step, inserting the new tail job before the deploy job ended.
That left duplicate `run` keys and misplaced deploy steps.

## Impact

No commit, push, workflow dispatch, or external action occurred. The malformed
candidate was caught by an immediate full-file read.

## Reproduction conditions

Insert a new YAML job using a non-unique environment-block anchor instead of
the end of the existing job.

## Safe evidence

The local file read showed the tail job between the authorization environment
and its command, with the remaining deploy steps nested under tail.

## Attempts and outcomes

- The malformed local candidate was not tested or committed.
- The correction restores the existing deploy job and appends the independent
  tail job after its final step.

## Cause classification

- **Confirmed cause:** The patch context was not structurally unique.
- **Rejected hypotheses:** None.
- **Known exclusions:** GitHub, Cloudflare, Neon, and R2 were unchanged.

## Correction and prevention

- **Correction:** Replace the complete jobs tail from `deploy` onward rather
  than using an ambiguous anchor.
- **Prevention:** Read the entire YAML after structural edits and prefer
  job-boundary anchors.
- **Owner:** Codex.

## Verification and related work

Closed because the malformed candidate was contained locally before execution;
the corrected workflow must still pass the RED test.

## Recurrence history

- 2026-07-26T22:26:01Z: First occurrence.
