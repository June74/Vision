# SB-20260726-225722-preview-validator-read-stale-artifact: Preview validator read stale artifact

- **Status:** closed
- **First observed:** 2026-07-26T22:57:22Z
- **Last observed:** 2026-07-26T22:57:22Z
- **Phase/task:** Phase B normal schedule restoration
- **Environment:** Local preview deployment verification
- **Version/commit:** `ffb3c0a` plus uncommitted schedule restoration

## Symptom

The preview configuration validator rejected the generated deployment artifact
immediately after the source cron changed back to the normal daily schedule.

## Impact

Local verification was delayed. No preview deployment or provider state changed.

## Reproduction conditions

Change `wrangler.jsonc` after the last build, then run the validator without
regenerating `dist/vision/wrangler.json`.

## Safe evidence

The validator emitted only its fixed invalid-configuration message.

## Attempts and outcomes

- Validation against the previously generated artifact failed.
- The correction rebuilds the preview artifact before running the validator.

## Cause classification

- **Confirmed cause:** The validator reads the generated build artifact, which
  still contained the temporary cron until a new build was produced.
- **Hypotheses:** None.
- **Rejected hypotheses:** The source configuration itself was not shown to be
  invalid by this result.
- **Known exclusions:** No Cloudflare or Neon state changed.

## Correction and prevention

- **Correction:** Run the preview build before `deploy:check:preview`.
- **Prevention:** Treat artifact generation and artifact validation as an
  ordered pair whenever deployment configuration changes.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Rebuild, validate, and run the focused schedule
  tests.

## Verification and related work

Closure is based on the deterministic stale-artifact mismatch; the corrected
build-and-validate sequence follows this record.

## Recurrence history

- 2026-07-26T22:57:22Z: First observed and closed.
