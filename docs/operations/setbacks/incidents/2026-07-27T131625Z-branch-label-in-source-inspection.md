# SB-20260727-131625-branch-label-in-source-inspection: Source inspection returned a branch label

- **Status:** contained
- **First observed:** 2026-07-27T13:16:25Z
- **Last observed:** 2026-07-27T13:17:45Z
- **Phase/task:** Phase B restore Task 4 tail correction
- **Environment:** Local repository inspection
- **Version/commit:** Pending correction commit

## Symptom

A broad read of an existing setback record returned a prohibited branch label in tool output.

## Impact

The label was not needed for the correction. No credential, provider value, database value, token, key, or raw tail data was returned.

## Reproduction conditions

Read a complete existing incident instead of projecting only the safe fields needed for the local-runner workaround.

## Safe evidence

- The uncontrolled field was an existing branch label.
- No provider-controlled records or protected values were copied into repository changes.

## Attempts and outcomes

1. Read a complete prior incident: prohibited label returned.
2. Stopped broad record reads and switched to fixed, safe command-result summaries.

## Cause classification

- **Confirmed cause:** The inspection returned the full prior incident rather than a fixed projection.
- **Hypotheses:** None open.
- **Rejected hypotheses:** No source change or test fixture caused the output.
- **Known exclusions:** No secrets or provider data were returned or persisted.

## Correction and prevention

- **Correction:** Stop using full-record reads for prior incident inspection.
- **Prevention:** Query only fixed safe values and avoid provider or repository identifiers in tool output.
- **Owner:** Codex.
- **Next diagnostic step:** None while contained.

## Verification and related work

- Subsequent verification commands return only pass counts or fixed safe results.

## Recurrence history

- 2026-07-27T13:17:45Z: A local commit-status line returned the existing branch
  label. No credentials, provider data, database value, or raw tail data was
  returned. Subsequent repository writes use quiet output.
