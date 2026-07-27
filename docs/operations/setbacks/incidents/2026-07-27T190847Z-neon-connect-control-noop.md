# SB-20260727-190847-neon-connect-control-noop: Neon branch Connect control produced no connection panel

- **Status:** closed
- **First observed:** 2026-07-27T19:08:47Z
- **Last observed:** 2026-07-27T19:15:05Z
- **Phase/task:** Phase B restore Task 4 live retry
- **Environment:** Signed-in Neon disposable branch details
- **Version/commit:** `9bbc4be`

## Symptom

The enabled branch-specific Connect control produced no visible connection
panel or clipboard change.

## Impact

The disposable database URL was not transferred to Cloudflare. No temporary
secret, deployment, database mutation, or credential change occurred.

## Reproduction conditions

Activate the unique branch-specific Connect control through either the scoped
browser locator or the fresh visible-node control.

## Safe evidence

Both actions left the connection panel absent, the clipboard unchanged, and
the browser error count at zero. Only fixed booleans and lengths were checked.

## Attempts and outcomes

- A scoped semantic click produced no panel.
- A fresh visible-node click produced no panel.
- The clipboard remained the prior non-secret query.
- Repetition of the same control stopped.

## Cause classification

- **Confirmed cause:** The current Connect control path did not expose a
  connection value in this browser session.
- **Hypotheses:** The provider UI may require a different branch connection
  widget or a page state not represented by this control.
- **Rejected hypotheses:** The control was not disabled and no browser error
  was recorded.
- **Known exclusions:** No database URL, password, target identity, branch
  identifier, or provider URL was emitted.

## Correction and prevention

- **Correction:** Use a distinct branch connection widget or provider-supported
  copy control after proving its scope.
- **Prevention:** Stop after two independently targeted no-op activations and
  change UI surface instead of retrying.
- **Owner:** Codex.
- **Next diagnostic step:** Inspect the branch detail page for a dedicated
  connection-string copy widget.

## Verification and related work

Opening the same project dashboard in a fresh provider tab made the unique
branch Connect control responsive. The selected application-role URL then
passed private scheme, role, SSL, and unmasked-value checks.

## Recurrence history

- 2026-07-27T19:08:47Z: First observed and contained without state change.
- 2026-07-27T19:15:05Z: Closed after a fresh provider tab produced a valid
  connection field without exposing its contents.
