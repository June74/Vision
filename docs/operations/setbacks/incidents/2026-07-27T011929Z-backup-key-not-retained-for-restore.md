# SB-20260727-011929-backup-key-not-retained-for-restore: Backup key was not retained for restore

- **Status:** investigating
- **First observed:** 2026-07-27T01:19:29Z
- **Last observed:** 2026-07-27T01:19:29Z
- **Phase/task:** Phase B encrypted restore drill
- **Environment:** Preview Cloudflare Worker and local operator command
- **Version/commit:** `13badf7`

## Symptom

The live backup is encrypted with a key available to the Worker as a write-only
secret, but the operator restore environment has no retained copy of that key.

## Impact

The reviewed local restore command cannot authenticate and decrypt the live
backup object. The disposable Neon branch must remain until a valid encrypted
round trip succeeds.

## Cause classification

- **Confirmed cause:** The backup-only key was configured in Cloudflare without
  first retaining the same version in an operator-controlled secret manager as
  required by the runbook.
- **Known exclusions:** The encrypted object, R2 binding, target attestation,
  and database migrations are present; none supplies the missing decryption
  capability to the local operator command.

## Correction and prevention

- **Correction:** Use a separately reviewed, temporary Worker-only restore path
  that keeps the existing key inside Cloudflare, or rotate to a newly retained
  key, create a new backup, and restore that new object.
- **Prevention:** Before storing a backup key in a write-only runtime secret,
  require a recorded boolean attestation that the same key version is retained
  in the approved operator secret manager. Never treat a runtime secret store
  as the only copy of recovery material.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Obtain explicit approval for one recovery design
  before changing runtime code or rotating recovery material.

## Verification and related work

Pending.

