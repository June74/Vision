# SB-20260728-135700-browser-escape-closed-neon-dialog: Escape closed the Neon connection dialog

- **Status:** closed
- **First observed:** 2026-07-28T13:57:00Z
- **Last observed:** 2026-07-28T13:57:00Z
- **Phase/task:** Preview database role probe Task 2 opaque transfer
- **Environment:** Signed-in Neon browser controls
- **Version/commit:** `d077516`

## Symptom

Pressing Escape after verifying the role selector closed the entire connection
dialog instead of only the selector.

## Impact

Read-only connection inspection was delayed. No secret, provider, database,
R2, restore, deployment, or key state changed.

## Reproduction conditions and safe evidence

Open the role selector inside the connection dialog and press Escape. A bounded
dialog count changes to zero.

## Cause classification

- **Confirmed cause:** Escape propagated to the dialog-level close behavior.
- **Hypotheses:** None.
- **Rejected hypotheses:** Provider mutation; the action only closed a
  read-only dialog.
- **Known exclusions:** No private value or provider identifier was emitted.

## Attempts and outcomes

1. One Escape press closed the dialog.
2. The dialog was reopened without altering provider state.

## Correction and prevention

- **Correction:** Reopen the dialog and leave the verified selector untouched.
- **Prevention:** Do not use Escape to close a nested selector in this provider
  dialog.
- **Owner:** Codex.
- **Next diagnostic step:** None.

## Verification and related work

The reopened dialog retained signed-in read-only access and no mutation was
observed.
