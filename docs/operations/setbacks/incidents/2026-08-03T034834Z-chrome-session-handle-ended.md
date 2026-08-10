# SB-20260803-034834-chrome-session-handle-ended: Finalized Chrome session handle was unavailable on resume

- **Status:** closed
- **First observed:** 2026-08-03T03:48:34.2455373Z
- **Last observed:** 2026-08-03T03:48:34.2455373Z
- **Phase/task:** Phase B corrected candidate deployment
- **Environment:** Local signed-in Chrome control session
- **Version/commit:** Candidate `c1911f8`; preview not redeployed by Codex

## Symptom

The prior in-memory Chrome binding was absent after the deliberately finalized
handoff session.

## Impact

The first read-only tab inventory did not run. No browser or provider state
changed.

## Safe evidence

Only the local missing-binding error was emitted; no URL, identifier, or value
was read.

## Cause classification

- **Confirmed cause:** Browser bindings are scoped to their finalized control
  session and must be recreated after handoff.
- **Known exclusions:** The user's Chrome tab itself remained open.

## Correction and prevention

- **Correction:** Initialized a fresh browser connection and selected signed-in
  Chrome through the supported browser runtime.
- **Prevention:** Treat finalized browser handles as unavailable on a later
  task and create a fresh binding before tab discovery.
- **Owner:** Codex.

## Verification and related work

Fresh Chrome selection succeeded; incident closed before provider access.

## Recurrence history

- 2026-08-03T03:48:34.2455373Z: Observed and closed after supported reconnect.
