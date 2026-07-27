# SB-20260727-011929-backup-key-not-retained-for-restore: Backup key was not retained for restore

- **Status:** contained
- **First observed:** 2026-07-27T01:19:29Z
- **Last observed:** 2026-07-27T02:03:51Z
- **Phase/task:** Phase B encrypted restore drill
- **Environment:** Preview Cloudflare Worker and local operator command
- **Version/commit:** `4ccf04b`

## Symptom

The live backup is encrypted with a key available to the Worker as a write-only
secret, but the operator restore environment has no retained copy of that key.

## Impact

The reviewed local restore command cannot authenticate and decrypt the live
backup object. The disposable Neon branch must remain until a valid encrypted
round trip succeeds.

## Reproduction conditions and safe evidence

- The unchanged backup key is available only to the existing Worker secret
  binding.
- The local operator environment has no retained copy.
- The encrypted object, disposable target, and target attestation exist, but
  none can supply the local decryptor with the key.

## Attempts and outcomes

1. The local restore path was stopped before decryption because its required
   operator key is unavailable.
2. Key rotation was excluded by explicit user instruction.
3. A temporary preview-only scheduled restore inside the existing Worker was
   designed as the remaining unchanged-key path.
4. Explicit approval for that new runtime mechanism remained unanswered across
   three consecutive goal turns. No restore code, deployment, database write,
   branch deletion, or key change occurred.
5. On 2026-07-27, the user explicitly approved the temporary preview-only
   restore using the existing unchanged backup key. Design documentation and
   review resumed; implementation remains gated on written-spec review.

## Cause classification

- **Confirmed cause:** The backup-only key was configured in Cloudflare without
  first retaining the same version in an operator-controlled secret manager as
  required by the runbook.
- **Hypotheses:** None.
- **Rejected hypotheses:** The existing local restore command cannot recover
  the key from the encrypted object, target database, or write-only Worker
  secret.
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
- **Next diagnostic step:** Complete written-spec review, then implement the
  approved temporary path. The existing key remains unchanged.

## Verification and related work

Pending.

## Recurrence history

- 2026-07-27T01:19:29Z: First observed and contained before any restore write.
- 2026-07-27T02:03:51Z: The approval dependency persisted for three
  consecutive goal turns after all independent safe work was exhausted.
