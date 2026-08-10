# SB-20260726-193142-stale-cloudflare-tab-descriptor: Stale Cloudflare tab descriptor was reused

- **Status:** contained
- **First observed:** 2026-07-26T19:31:42.622047Z
- **Last observed:** 2026-08-02T04:21:56.3753300Z
- **Phase/task:** Phase B Task 8 owner authentication diagnosis
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
- 2026-08-02T02:21:16.6256802Z: Fresh discovery found exactly one Vision, one
  Cloudflare, and one Neon tab, but the combined claim sequence exceeded the
  browser-control deadline and reset before any page was read. No page content,
  credential, provider identifier, repository state, or external state was
  accessed or changed. The immediate cause is the claim timeout; whether one
  specific tab or the combined sequence caused it remains unconfirmed. Recovery
  must follow the Chrome troubleshooting guidance and claim tabs one at a time.
- 2026-08-02T02:22:42.0822228Z: Chrome's lightweight open-tab call succeeded,
  proving the extension connection was available, but claiming the single
  freshly discovered Vision tab alone again exceeded the deadline and reset
  before page access. The existing-tab claim path is now rejected for this
  task. Recovery uses separate read-only tabs in the same Chrome profile so
  signed-in cookies can be reused without controlling or altering the user's
  existing tabs.
- 2026-08-02T02:28:43.2430255Z: The retained read-only Vision, Cloudflare, and
  Neon tab bindings survived in local JavaScript state, but their underlying
  browser session contained no tabs. The first bounded DOM read failed before
  any page access or provider action. The browser connection remains valid;
  recovery discards only the stale tab bindings and opens fresh read-only tabs.
- 2026-08-02T02:35:33.9645634Z: The authenticated Cloudflare root exposed two
  matching R2 text nodes, but the counted locator expired during bounded
  element classification before any click. No provider state changed. Recovery
  discards the locator and rebuilds it from a fresh dashboard snapshot.
- 2026-08-02T03:20:13.4599351Z: The retained Vision tab binding was no longer
  defined after the session boundary, so the first boolean-only page check
  stopped before reading or changing the page. No application, account, or
  provider state changed. Recovery reinitializes the browser connection and
  obtains a fresh read-only Vision tab before continuing.
- 2026-08-02T04:18:55.2729497Z: The retained Chrome binding was no longer
  defined between the completed Cloudflare name/type check and the attempted
  Neon read-only check. No page interaction, secret edit, query, or provider
  mutation occurred. Recovery reinitializes the browser connection and opens
  fresh provider tabs while preserving only boolean and count evidence.
- 2026-08-02T04:21:56.3753300Z: The uniquely counted Neon navigation control
  exceeded its interaction deadline before opening. No SQL editor, query,
  database value, secret edit, or provider mutation occurred. Dashboard
  automation stops at this boundary; the owner receives the exact manual path
  instead of further locator retries.
