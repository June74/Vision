# Preview acceptance correlation-wait design

## Problem

The live role-probe controller reached `observer_ready`, then stopped before
candidate attribution while the candidate workflow was still running its
verification checks. The candidate correlation artifact was later confirmed to
be downloadable and to match the operation, reviewed commit, and local pending
journal context hash. The generic 120-second controller-call window is therefore
too narrow for this provider-correlation boundary in some live runs.

## Goal

Give observer and candidate dispatches a dedicated five-minute correlation
window so the controller can receive and verify the dispatch receipt before
falling back to reconciliation. Preserve every attribution, candidate-intent,
rollback, closure, and fail-closed rule.

## Non-goals

- No Cloudflare, Neon, Google, GitHub secret, or provider configuration changes.
- No change to candidate-intent validation or the meaning of a timeout-reconciled
  candidate.
- No weakening of automatic rollback or closure verification.
- No change to the application Worker or user-facing behavior.

## Design

1. Add one controller constant, `DISPATCH_CORRELATION_MILLISECONDS`, set to
   five minutes.
2. Add a dispatch-deadline helper bounded by the acceptance expiry buffer.
   Observer and `deploy_*` candidate dispatches use this helper; rollback and
   closure dispatches retain their existing cleanup deadlines.
3. Pass the dedicated correlation duration to the dispatch call boundary. The
   existing reconciliation path remains active if the dedicated window expires,
   and a timeout-reconciled candidate still triggers the existing rollback and
   fail-closed behavior.
4. Add a unit regression that delays a candidate correlation receipt beyond 120
   seconds but below five minutes and verifies that the controller does not
   prematurely reconcile or claim success without candidate attribution.

## Data flow

```text
controller
  -> observer/candidate dispatch
  -> correlation artifact receipt (up to 5 minutes)
  -> existing attribution and candidate-intent checks
  -> existing action, signal, rollback, and closure lifecycle
```

The window only changes how long the controller waits for the exact dispatch
receipt. It does not accept a run by timing alone.

## Verification

- Red/green unit test for the delayed-correlation boundary.
- Full controller unit suite.
- TypeScript/build and documentation checks.
- One fresh monitored role-probe acceptance with automatic rollback, followed by
  the existing restore-drill gates if role-probe closure succeeds.

## Rollback

If the focused test or full suite fails, revert only the controller change and
its regression test. If a live candidate reaches any deployment boundary,
retain the existing automatic rollback and closure workflow; do not bypass it.
