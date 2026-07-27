# SB-20260727-024307-restore-plan-interface-mismatch: Restore plan mismatched the current import interface

- **Status:** closed
- **First observed:** 2026-07-27T02:43:07Z
- **Last observed:** 2026-07-27T02:43:07Z
- **Phase/task:** Phase B restore Task 1
- **Environment:** Local Phase B worktree
- **Version/commit:** `574ea0a`

## Symptom

The approved Task 1 plan showed a three-argument restore call even though the
current restore API requires the verified encrypted envelope, unchanged
backup key, target, and options as four arguments. It also implied concrete
Neon adapters belonged inside an otherwise injected engine.

## Impact

The implementer stopped before editing. No code, provider state, secret, key,
backup, or database changed.

## Reproduction conditions

Compare the Task 1 snippet with the current `importBackup` signature and the
design's injected dependency boundary.

## Safe evidence

The current interface requires four arguments. The verified stored-backup
reader returns a closed result plus the encrypted envelope.

## Attempts and outcomes

- The implementer reported `NEEDS_CONTEXT` before making changes.
- Direct signature inspection confirmed both mismatches.

## Cause classification

- **Confirmed cause:** The plan was written from an outdated mental model of
  the restore API and did not preserve the chosen dependency boundary.
- **Hypotheses:** None.
- **Rejected hypotheses:** No new default production-dependency export is
  required in Task 1.
- **Known exclusions:** The design's cryptographic and target-attestation
  invariants remain unchanged.

## Correction and prevention

- **Correction:** Use the current four-argument restore call and keep concrete
  Neon adapter construction in Task 2's production dependency factory.
- **Prevention:** Trace exact live signatures before finalizing plan code
  snippets.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected plan and regenerated Task 1 brief must pass documentation and
diff checks before implementation resumes.

## Recurrence history

- 2026-07-27T02:43:07Z: First observed and contained before editing.
