# SB-20260730-191109-timing-helper-reexport-omitted: Timing helper re-export was omitted

- **Status:** closed
- **First observed:** 2026-07-30T19:11:09.542086Z
- **Last observed:** 2026-07-30T19:11:56.7393037Z
- **Phase/task:** Phase B live-acceptance closure Task 1 GREEN
- **Environment:** Local Phase B linked worktree
- **Version/commit:** `44d8e93802ce834fd0c8ca620d81472e23431b00`

## Symptom

The focused GREEN retry reported that the new lifetime helper was unavailable through the timing script module.

## Impact

One focused test remained red; no provider or external state changed.

## Reproduction conditions

Run the exact four-file focused unit suite after adding the new domain export
without also adding it to the timing script's explicit re-export list.

## Safe evidence

The suite reported one unavailable function in the timing test while the other
121 focused tests passed. No private value was rendered.

## Attempts and outcomes

- The first correction added the symbol only to the script's local import and
  reproduced the same single failure.
- The second correction added it to the explicit re-export list; all 122
  focused tests passed.

## Cause classification

- **Confirmed cause:** The script's explicit re-export list omitted the new
  domain helper; the first correction targeted the adjacent import list.
- **Hypotheses:** None.
- **Rejected hypotheses:** The domain implementation itself was not missing;
  its direct domain tests passed.
- **Known exclusions:** No provider, database, network, or external state was
  involved.

## Correction and prevention

- **Correction:** Added the helper to the timing script's explicit re-export
  list.
- **Prevention:** Inspect both import and re-export clauses when a module
  intentionally fronts a domain API.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The four-file focused unit suite passed 122 tests after the correction.

## Recurrence history

- 2026-07-30T19:11:09.542086Z: First observed.
- 2026-07-30T19:11:56.7393037Z: The explicit re-export correction was
  verified by the same focused suite with 122 passing tests.
