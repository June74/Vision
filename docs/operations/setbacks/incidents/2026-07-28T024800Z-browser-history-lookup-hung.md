# SB-20260728-024800-browser-history-lookup-hung: Browser history lookup hung

- **Status:** closed
- **First observed:** 2026-07-28T02:48:00Z
- **Last observed:** 2026-07-28T02:52:00Z
- **Phase/task:** Preview database role probe Task 2 Step 2
- **Environment:** Signed-in browser controls
- **Version/commit:** `979228b`

## Symptom

A focused read-only browser-history lookup did not return and was interrupted.

## Impact

Provider navigation was delayed. No click, secret operation, workflow dispatch,
deployment, database query, R2 access, restore, or key change occurred.

## Reproduction conditions and safe evidence

Invoke the focused history lookup while an already-open signed-in provider tab
is available. The call remains pending until interrupted.

## Cause classification

- **Confirmed cause:** The browser-history control call hung.
- **Hypotheses:** The history enumeration stalled independently of the
  signed-in provider page.
- **Rejected hypotheses:** Provider sign-in or mutation failure; the history
  lookup was read-only and the provider page remained available.
- **Known exclusions:** No browsing history contents, authenticated URLs,
  provider identifiers, or private values were emitted.

## Attempts and outcomes

1. One focused history lookup hung.
2. The call was interrupted and not retried.
3. The already-open provider tab supported bounded page-local checks.

## Correction and prevention

- **Correction:** Resume from the existing signed-in tab.
- **Prevention:** Prefer current-tab discovery and page-local checks; do not
  enumerate browser history when the target tab is already open.
- **Owner:** Codex.
- **Next diagnostic step:** None.

## Verification and related work

Provider navigation resumed without a history call, and no external state had
changed during the interruption.
