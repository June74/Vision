# SB-20260727-171617-browser-locator-composition-unsupported: Browser locator composition was unsupported

- **Status:** closed
- **First observed:** 2026-07-27T17:16:17Z
- **Last observed:** 2026-07-28T03:01:00Z
- **Phase/task:** Preview database role probe Task 2 Step 2
- **Environment:** Signed-in disposable database provider dashboard
- **Version/commit:** `7d2f9f6` with reviewed candidate `0f08fc1`

## Symptom

Combining a table-row locator with a child row-header locator failed inside the
browser-control library before a row could be selected.

## Impact

No click occurred and no provider, repository, credential, database, or runtime
state changed. The disposable-target lookup paused.

## Reproduction conditions

Pass an existing browser locator as the `has` filter of a second locator in
this browser-control runtime.

## Safe evidence

The runtime rejected the locator composition before interaction. No provider
text or identifier is reproduced here.

## Attempts and outcomes

- The row header and row were structurally confirmed inside the page.
- The composed locator failed before its count could be returned.
- No retry of the same locator form was attempted.

## Cause classification

- **Confirmed cause:** This browser-control runtime did not accept that locator
  object composition.
- **Hypotheses:** None open.
- **Rejected hypotheses:** Provider authorization, row availability, and
  database state were not implicated.
- **Known exclusions:** No secret, database URL, branch identifier, account
  identifier, token, key, or provider URL was emitted.

## Correction and prevention

- **Correction:** Use a freshly grounded row selector filtered by the known
  project text without embedding a second locator object.
- **Prevention:** Avoid cross-locator `has` composition in this runtime; prefer
  one scoped selector plus a validated count.
- **Owner:** Codex.
- **Next diagnostic step:** Count the project row with one text-filtered row
  locator and click only if it is unique.

## Verification and related work

Closed after the simpler single-locator row filter uniquely selected the
project and disposable branch rows and completed the bounded provider work.

## Recurrence history

- 2026-07-27T17:16:17Z: First observed and contained.
- 2026-07-27T17:57:10Z: Closed after one scoped text-filtered row locator
  replaced the unsupported composed locator and completed the required
  selection without returning provider identifiers.
- 2026-07-27T19:16:40Z: Recurred while composing the variables-and-secrets
  section with its heading locator. No form opened and no value moved. The
  fresh visible-node section map replaced locator composition.
- 2026-07-28T01:44:16.5948330Z: Recurred while composing the signed-in
  database-provider project locator. The browser rejected the nested locator
  before interaction. A simpler bounded text filter located the already-known
  project surface; no provider value or state changed.
- 2026-07-28T03:01:00Z: Recurred while composing the Variables and Secrets
  section with its heading locator. The operation failed before any click. A
  bounded section-structure read identified one section-local Add control; no
  secret or provider state changed.
