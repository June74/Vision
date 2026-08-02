# Task 7 direct-evidence test patch placement error

- **Occurred:** 2026-08-01T23:59:55.7965897Z
- **Status:** closed
- **Resolved:** 2026-08-02T00:12:17.6710563Z
- **Phase:** Phase B / tracked correlation repair / Task 7 direct-evidence RED
- **Category:** patch context placement
- **Related:** SB-20260801-235809

## What happened

Three new direct-correlation category names were inserted as extra arguments inside an existing projection-guard `record(...)` call instead of appearing only in their own later assertions.

The bounded source inspection caught the mistake before syntax checks or tests ran. No live/provider action occurred and no sensitive value was emitted.

## Impact

The intended RED is not yet valid because the existing projection-guard assertion would be mis-recorded.

## Corrective action

Remove only the three misplaced string arguments, confirm each category still has exactly one intended `record(...)` site, run both syntax checks, and then run the contained RED.

## Prevention

After multi-hunk patches that anchor on a nearby category string, inspect every inserted identifier occurrence before executing the test.

## Resolution

The three misplaced strings were removed, each new category was confirmed to have one intended assertion site, and both Node syntax checks passed before the contained RED. The final expanded suite passed 92/92.
