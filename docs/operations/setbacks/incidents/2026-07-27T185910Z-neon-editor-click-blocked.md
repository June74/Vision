# SB-20260727-185910-neon-editor-click-blocked: Neon editor click was blocked before attestation write

- **Status:** closed
- **First observed:** 2026-07-27T18:59:10Z
- **Last observed:** 2026-07-27T19:00:19Z
- **Phase/task:** Phase B restore Task 4 live retry
- **Environment:** Signed-in Neon SQL editor
- **Version/commit:** `9bbc4be`

## Symptom

The visible editor did not accept focus while staging the operator-owned
attestation transaction.

## Impact

The transaction was neither copied back nor executed. The attestation remained
absent, and no database, secret, or deployment state changed.

## Reproduction conditions

Attempt to refocus the editor while the branch-selector UI may still cover the
workspace.

## Safe evidence

The browser timed out before the copy-back and keyboard execution steps. No SQL
body or private value was emitted.

## Attempts and outcomes

- The editor focus step timed out.
- The guarded sequence stopped before execution.
- The recovery path closes the selector and reacquires the visible editor from
  a fresh page snapshot.

## Cause classification

- **Confirmed cause:** The editor was not actionable during the bounded click
  attempt.
- **Hypotheses:** The previously opened branch selector remained over the
  editor.
- **Rejected hypotheses:** The attestation transaction did not execute.
- **Known exclusions:** No database or provider mutation occurred.

## Correction and prevention

- **Correction:** Close transient selector UI and reacquire the editor before
  restaging.
- **Prevention:** After branch verification, explicitly close its selector and
  take a fresh snapshot before editing.
- **Owner:** Codex.
- **Next diagnostic step:** Verify the branch selector is closed and the
  content-editable is uniquely actionable.

## Verification and related work

After closing the selector, the fresh editor copied back the exact transaction.
The transaction returned a commit signal and the independent read-only target
check returned the fixed ready marker.

## Recurrence history

- 2026-07-27T18:59:10Z: First observed and contained before execution.
- 2026-07-27T19:00:19Z: Closed after exact copy-back, commit, and independent
  ready-marker verification.
