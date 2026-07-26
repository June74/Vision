# SB-20260726-193142-stale-cloudflare-tab-descriptor: Stale Cloudflare tab descriptor was reused

- **Status:** closed
- **First observed:** 2026-07-26T19:31:42.622047Z
- **Last observed:** 2026-07-26T19:33:19.4460335Z
- **Phase/task:** Phase B live deployment verification
- **Environment:** Signed-in Cloudflare browser session
- **Version/commit:** `066fcbd`

## Symptom

A previously discovered browser-tab address no longer represented the active Worker settings page, so navigation did not return to the expected view.

## Impact

No provider setting changed; live verification paused while navigation recovered from visible dashboard controls.

## Reproduction conditions

Navigate using the address stored in the original tab-discovery descriptor
after the tab has traversed multiple Cloudflare routes.

## Safe evidence

The stale navigation produced only an empty alert view and changed no provider
configuration.

## Attempts and outcomes

- The stored descriptor did not return to Worker settings.
- The browser returned to the Cloudflare dashboard root.
- The visible, uniquely named Worker link reopened the current Worker page.
- Bindings, variables, and schedules were then verified live.

## Cause classification

- **Confirmed cause:** The discovery descriptor was not a current navigation
  source after subsequent route changes.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** Authentication and the deployed Worker remained
  available.

## Correction and prevention

- **Correction:** Recovered through the dashboard root and a unique visible
  Worker link.
- **Prevention:** Treat old discovery descriptors as claim handles only; use
  current DOM navigation for later route recovery.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The recovered Worker page showed every required live variable, binding, Queue
event, and cron schedule.

## Recurrence history

- 2026-07-26T19:31:42.622047Z: First observed.
