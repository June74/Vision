# SB-20260731-155758-ledger-patch-file-boundary: Setback update omitted a file boundary

- **Status:** closed
- **First observed:** 2026-07-31T15:57:58.8592092Z
- **Last observed:** 2026-07-31T16:52:38.9496404Z
- **Phase/task:** Phase B Task 3 second-wave blocker repair
- **Environment:** Local setback-ledger edit
- **Version/commit:** 6dfdd38

## Symptom

A multi-file ledger patch omitted the second file header, so its verification
failed on an expected status line and the patch was rejected atomically.

## Impact

No file changed, no provider or network action occurred, and no secret or
protected value was involved.

## Cause classification

- **Confirmed cause:** The patch joined hunks for two incidents without an
  intervening `Update File` declaration.
- **Hypotheses:** None remaining.
- **Known exclusions:** The failed patch made no partial mutation.

## Correction and prevention

- **Correction:** Reissue the update with an explicit file declaration before
  every incident hunk.
- **Prevention:** Keep multi-file ledger patches structurally separated and
  verify current status fields before editing.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Recurrence history

- 2026-07-31T15:57:58.8592092Z: First observed and closed by the structurally
  separated replacement patch.
- 2026-07-31T16:18:57.3673790Z: Reopened when a single large five-incident
  closure patch failed verification on an index-row context even though the
  files remained unchanged. No source, provider, network, secret, or external
  state was affected. The retry uses one exact incident patch at a time and a
  separate index patch.
- 2026-07-31T16:20:19.4771780Z: Closed after five exact incident patches and
  one separate index patch applied and matched the intended closure state.
- 2026-07-31T16:50:58.3668193Z: Reopened after a combined third-review ledger
  update used an imprecise tail sentence and failed verification atomically.
  No source, provider, network, secret, or external state changed. The retry
  uses separate exact incident patches followed by a separate index patch.
- 2026-07-31T16:51:54.7341358Z: The two-row index patch also failed
  verification even though bounded inspection showed both expected rows. No
  partial change occurred. All remaining index updates use one row per patch.
- 2026-07-31T16:52:38.9496404Z: Closed after all three one-row index updates
  applied and matched their incident files exactly.
