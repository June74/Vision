# SB-20260727-185253-branch-label-rejected-as-target-id: Branch label was tentatively misidentified as target identity

- **Status:** closed
- **First observed:** 2026-07-27T18:52:53Z
- **Last observed:** 2026-07-27T18:52:53Z
- **Phase/task:** Phase B restore Task 4 live retry
- **Environment:** Signed-in Neon SQL editor
- **Version/commit:** `9bbc4be`

## Symptom

A unique private-shaped value in the page was tentatively classified as the
database-owned restore target identity.

## Impact

The value was never printed, copied to Cloudflare, saved locally, or used by
the restore. The live retry remained blocked until an actual SQL result could
be proven.

## Reproduction conditions

Infer a result value from a visible leaf-node shape without first proving that
the node belongs to the query result container.

## Safe evidence

Ancestor inspection showed the value belonged to the branch-navigation region,
not the SQL result. Only fixed booleans and lengths were returned.

## Attempts and outcomes

- The tentative candidate passed the general opaque-identifier shape check.
- Ancestor inspection disproved the result-container hypothesis.
- The candidate was immediately cleared from browser working state.

## Cause classification

- **Confirmed cause:** Page-wide candidate extraction was insufficiently
  scoped to the SQL result container.
- **Hypotheses:** None open.
- **Rejected hypothesis:** The unique private-shaped value was the
  database-owned restore target identity.
- **Known exclusions:** No secret, target identity, branch label, URL, or
  protected row was emitted.

## Correction and prevention

- **Correction:** Accept target identity only from a proven SQL result cell.
- **Prevention:** Require result-container ancestry before classifying any
  provider-page value; never substitute branch display names for database
  attestation values.
- **Owner:** Codex.
- **Next diagnostic step:** Produce a result-only query and inspect its proven
  result container.

## Verification and related work

The tentative value was cleared and no external write used it.

## Recurrence history

- 2026-07-27T18:52:53Z: First observed, disproved, and contained before use.
