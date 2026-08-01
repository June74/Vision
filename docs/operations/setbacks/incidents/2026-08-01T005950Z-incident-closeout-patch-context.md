# Setback SB-20260801-005950-incident-closeout-patch-context

- **Status:** closed
- **Detected:** 2026-08-01T00:59:50.3477440Z
- **Scope:** Phase B Gate 0 setback closeout

## What happened

An incident-closeout patch used stale multi-file context and was rejected
atomically before any edit was applied.

## Impact

Two resolved incidents remained marked contained for one additional step. No
implementation, Git, or provider state changed.

## Correction and prevention

- **Correction:** Read each exact incident tail and apply smaller patches.
- **Prevention:** Close independent incidents with independent minimal-context
  patches.
- **Owner:** Codex.
- **Verification:** The replacement patches update both statuses and their
  matching index rows.
