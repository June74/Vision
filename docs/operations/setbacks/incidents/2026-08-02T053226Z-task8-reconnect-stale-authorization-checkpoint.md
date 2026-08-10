# SB-20260802-053226-task8-reconnect-stale-authorization-checkpoint: Reconnect left stale authorization failure

- **Status:** contained
- **First observed:** 2026-08-02T05:32:26.8942986Z
- **Last observed:** 2026-08-02T05:56:48.5896997Z
- **Phase/task:** Phase B Task 8 owner reconnect acceptance
- **Environment:** Deployed preview Worker and preview Neon database
- **Version/commit:** `e283410`

## Symptom

After a successful owner reconnect returned to Vision, the authenticated
foundation remained `Disconnected`.

## Impact

Task 8 Step 1 cannot close, and normal webhooks plus scheduled repair remain
ineligible while the persisted checkpoint is disconnected. The remaining live
acceptance sequence is paused before any candidate deployment.

## Reproduction conditions

Persist an authorization-disconnected Google Calendar checkpoint, then
complete a valid OAuth reconnect through the existing callback.

## Safe evidence

A signed-in read-only aggregate query returned only this closed shape:

- Google token present: true.
- Calendar setup connected: true.
- Canonical calendar connection present: true.
- Active channel present: true.
- Prior successful sync present: true.
- Latest checkpoint status: `disconnected`.
- Latest checkpoint error category: `authorization`.
- Owner, token, connected setup, canonical calendar, checkpoint, and
  maintenance alignment: true.
- Exact scheduler-owned authorization marker attached to the current
  checkpoint: true.
- Scheduler marker predates the newly persisted token: true.

No identity, row, token, calendar, channel, event, connection, provider, or key
value was selected or returned.

## Attempts and outcomes

- The rendered UI proved an authenticated session and safe calendar read.
- Source tracing proved the OAuth callback persists tokens but does not
  reconcile synchronization authorization state.
- Source tracing also proved webhook lookup and scheduled repair require a
  connected checkpoint, so waiting alone cannot recover this state.
- A second signed-in Boolean-only query proved the failure marker has the exact
  scheduler provenance required by the narrow recovery transition and predates
  the current token row.

## Cause classification

- **Confirmed cause:** The reconnect callback saves fresh credentials without
  clearing the exact prior authorization-disconnected checkpoint.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Missing token, missing setup, missing connection,
  missing active channel, and absence of prior successful sync were all
  rejected by the closed aggregate query.
- **Known exclusions:** No database row, provider setting, calendar content,
  credential, secret, or key was changed during diagnosis.

## Correction and prevention

- **Correction:** Add a narrowly guarded application recovery transition after
  successful token persistence; never clear non-authorization failures.
- **Prevention:** Add a test-first reconnect regression case and include
  connected checkpoint state in live authentication lifecycle acceptance.
- **Owner:** Codex for design, tests, and implementation; project owner for
  design approval and any fresh provider interaction.
- **Next diagnostic step:** Obtain approval for the narrow recovery design,
  then implement it through RED, GREEN, full verification, deployment, and a
  fresh privacy-safe reconnect check.

## Verification and related work

The incident remains contained. Manual SQL repair is intentionally rejected
because it would not prevent recurrence.

## Recurrence history

- 2026-08-02T05:32:26.8942986Z: First observed and contained before any manual
  database mutation or production-code change.
- 2026-08-02T05:56:48.5896997Z: Live Boolean-only reconciliation confirmed
  exact canonical alignment, scheduler marker provenance, and marker-before-
  token ordering. The incident remains contained pending the tested
  application repair; no database mutation occurred.
