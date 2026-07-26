# SB-20260726-192748-neon-dashboard-authentication-required: Neon dashboard requires user authentication

- **Status:** closed
- **First observed:** 2026-07-26T19:27:48.016238Z
- **Last observed:** 2026-07-26T19:45:09.1509946Z
- **Phase/task:** Phase B recovery and cost acceptance
- **Environment:** Signed-in Neon dashboard
- **Version/commit:** Phase B live acceptance

## Symptom

The available browser session reached the Neon sign-in boundary instead of an authenticated project dashboard.

## Impact

Live Neon usage measurement and disposable restore-branch work cannot proceed until the project owner signs in directly.

## Reproduction conditions

Open the Neon dashboard without an existing authenticated browser session.

## Safe evidence

The initial page required sign-in. A later fixed-shape check confirmed the
dashboard is authenticated and returned only aggregate usage totals.

## Attempts and outcomes

- The initial project view was blocked by the sign-in boundary.
- The project owner authenticated directly.
- A fixed-shape check confirmed access without returning credentials.

## Cause classification

- **Confirmed cause:** The browser session had not yet been authenticated.
- **Hypotheses:** None recorded.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No credential, database URL, token, or secret was
  requested or captured.

## Correction and prevention

- **Correction:** The project owner signed in directly.
- **Prevention:** Keep provider authentication user-controlled and verify only
  a fixed signed-in boolean before further actions.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The signed-in check succeeded and the cost and restore work is unblocked.

## Recurrence history

- 2026-07-26T19:27:48.016238Z: First observed.
