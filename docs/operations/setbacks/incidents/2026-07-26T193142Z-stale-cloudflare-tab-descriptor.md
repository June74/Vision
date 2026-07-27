# SB-20260726-193142-stale-cloudflare-tab-descriptor: Stale Cloudflare tab descriptor was reused

- **Status:** closed
- **First observed:** 2026-07-26T19:31:42.622047Z
- **Last observed:** 2026-07-27T23:42:27.0051244Z
- **Phase/task:** Listener-first restore retry Task 2
- **Environment:** Signed-in provider browser session
- **Version/commit:** `4420f6d`

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
  current DOM navigation for later route recovery. After an interrupted turn,
  confirm the browser and tab bindings exist before reusing them.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The recovered Worker page showed every required live variable, binding, Queue
event, and cron schedule.

The amended Task 2 browser connection remained responsive after interruption;
the stale tab binding was discarded before any provider selection or database
action.

## Recurrence history

- 2026-07-26T19:31:42.622047Z: First observed.
- 2026-07-26T22:08:06.7712930Z: Recurred when the saved Cloudflare tab handle
  timed out before an R2 read-only inspection; no provider action occurred and
  the tab was reacquired from the current browser session.
- 2026-07-27T17:06:16Z: Recurred after the user interruption reset the
  browser-control session and the saved tab binding was no longer defined. No
  page interaction or provider state change occurred. Recovery must initialize
  a fresh browser session and navigate from visible controls without tab
  enumeration.
- 2026-07-27T17:07:10Z: The fresh dashboard did not expose exactly one
  expected Worker shortcut after the bounded readiness delay, so recovery
  failed closed before navigation. No provider state changed. The next attempt
  must use a stable visible search control and require one exact result.
- 2026-07-27T17:09:42Z: A previously unique Workers link locator became stale
  after the dashboard client-side update, and its route read reached the
  interaction deadline before navigation. No provider state changed. The
  locator must be rebuilt from a fresh snapshot before reuse.
- 2026-07-27T18:02:59Z: The final schedule recheck reached the Worker overview,
  but the expected single Triggers control was not ready after the bounded
  load delay. The check failed before interaction and no provider state
  changed. The locator must be rebuilt from a fresh page state.
- 2026-07-27T23:42:27.0051244Z: Recurred after the amended Task 2 browser
  setup was interrupted and the previously created provider tab was no longer
  part of the browser session. The browser connection itself remained
  responsive; the stale tab binding was discarded before any provider
  selection or database action.
