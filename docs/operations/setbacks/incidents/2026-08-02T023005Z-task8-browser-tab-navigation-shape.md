# SB-20260802-023005-task8-browser-tab-navigation-shape: Browser tabs opened without navigation

- **Status:** closed
- **First observed:** 2026-08-02T02:30:05.1027574Z
- **Last observed:** 2026-08-02T05:51:23.8451089Z
- **Phase/task:** Phase B Task 8 signed-in read-only reconciliation
- **Environment:** Existing Chrome browser-control session
- **Version/commit:** Published Task 7 candidate on `codex/phase-b-foundation`

## Symptom

Three replacement read-only tabs were created, but each remained on a blank
document instead of navigating to its intended allowlisted dashboard.

## Impact

The signed-in reconciliation was delayed. No page, provider setting, database,
credential, secret, or project state was read or changed.

## Reproduction conditions

Pass an object containing a navigation target directly to the browser tab
creation method in this browser-control runtime.

## Safe evidence

All three documents reported an empty hostname and zero visible text. Only
Booleans and bounded character counts were returned.

## Attempts and outcomes

- The tab creation calls returned three tab bindings.
- A bounded allowlist evaluation returned no dashboard signals.
- A second bounded evaluation confirmed all three tabs were blank documents.
- The setback helper referenced by the personal logging skill was absent from
  the repository, so this incident and index row were created manually with
  the same required contract.

## Cause classification

- **Confirmed cause:** The object-form tab creation call did not perform
  navigation in this runtime.
- **Hypotheses:** None.
- **Rejected hypotheses:** Provider authentication loss was not evaluated
  because no provider page had loaded.
- **Known exclusions:** No external route or provider surface was reached.

## Correction and prevention

- **Correction:** Keep the fresh tab bindings and navigate each tab through
  its documented page-navigation method using an allowlisted public root.
- **Prevention:** Treat tab creation and navigation as separate operations;
  verify a safe hostname Boolean before reading dashboard state.
- **Owner:** Codex.
- **Next diagnostic step:** Navigate one replacement tab, prove its allowlisted
  hostname, then repeat for the remaining two tabs.

## Verification and related work

The same three tab bindings navigated successfully through the separate page
navigation method. Each returned its exact allowlisted hostname, and bounded
page-state reads proved the Vision sign-in surface plus authenticated
Cloudflare and Neon dashboard surfaces without provider mutation.

## Recurrence history

- 2026-08-02T02:30:05.1027574Z: First observed and corrected through explicit
  navigation.
- 2026-08-02T05:32:26.8942986Z: Recurred when a diagnostic tab was created
  with an object-form target and remained blank. A Boolean URL classification
  caught the blank document before any content read; the unsupported direct
  endpoint was abandoned and no external state changed.
- 2026-08-02T05:51:23.8451089Z: Recurred when the controller called an
  unsupported navigation method on an already-bound preview tab. The call
  failed before navigation, no application or provider state changed, and the
  controller returned to the documented page-navigation surface.
