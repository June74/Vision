# SB-20260726-220707-preview-workflow-abbreviated-ref: Preview workflow received abbreviated ref

- **Status:** closed
- **First observed:** 2026-07-26T22:07:07Z
- **Last observed:** 2026-07-26T22:07:07Z
- **Phase/task:** Phase B temporary backup deployment
- **Environment:** GitHub Actions preview workflow
- **Version/commit:** `cab6d4d`

## Symptom

The guarded preview workflow failed in `actions/checkout` before running any
repository checks.

## Impact

The deploy job was skipped, so Cloudflare was unchanged. The acceptance run
was delayed.

## Reproduction conditions

Dispatch the workflow with a seven-character commit abbreviation in its `ref`
input.

## Safe evidence

The checkout action treated the abbreviation as a branch/tag refspec and could
not fetch it. Every later verification and deploy step was skipped.

## Attempts and outcomes

- The abbreviated ref failed closed at checkout.
- The replacement dispatch uses the full immutable commit SHA.

## Cause classification

- **Confirmed cause:** The checkout action does not resolve the abbreviated SHA
  in this input/fetch mode.
- **Rejected hypotheses:** Application tests and Cloudflare credentials were
  never reached.
- **Known exclusions:** No Worker, database, R2 object, or secret changed.

## Correction and prevention

- **Correction:** Dispatch using `git rev-parse HEAD` output in full.
- **Prevention:** Never pass abbreviated commit IDs to the preview workflow's
  `ref` input.
- **Owner:** Codex.

## Verification and related work

Closed after establishing the deterministic input correction; the replacement
run provides the external verification.

## Recurrence history

- 2026-07-26T22:07:07Z: First occurrence.
