# SB-20260730-173336-subagent-name-registry-stale: Subagent name remained reserved after live registry cleared

- **Status:** closed
- **First observed:** 2026-07-30T17:33:36.523737Z
- **Last observed:** 2026-07-30T17:34:25.4802853Z
- **Phase/task:** Phase B live-acceptance plan final audit restart
- **Environment:** Local Codex collaboration registry
- **Version/commit:** `c8879b2d0dad`

## Symptom

A read-only audit dispatch using a previously assigned name was rejected as already existing while the live agent list showed only the root agent.

## Impact

One audit dispatch was delayed; no source code, provider state, or private data changed.

## Reproduction conditions

Reusing an audit task name from the prior compacted work session after the
live-agent listing no longer displayed that task.

## Safe evidence

The live-agent listing contained only the root agent, while the subsequent
spawn request returned the safe category that the requested agent path already
existed. No provider output or private value was inspected.

## Attempts and outcomes

- Rechecked the live registry before dispatch; it showed no child agents.
- Preserved the failed name and selected a new unique task name for the retry.

## Cause classification

- **Confirmed cause:** Unconfirmed.
- **Hypotheses:** Completed or compacted agent paths can remain reserved even
  after they disappear from the live-agent listing.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** The four-slot concurrency limit was not reached because
  the live listing showed only the root agent.

## Correction and prevention

- **Correction:** Retry each resumed audit with a date-and-sequence suffix
  instead of reusing a prior task name.
- **Prevention:** Treat agent task paths as session-durable identifiers; after
  compaction, always allocate a fresh unique name even when the prior path is
  absent from the live listing.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; reuse this prevention if the registry rejects
  another resumed name.

## Verification and related work

The uniquely named replacement audit started successfully on
2026-07-30T17:34:25.4802853Z. No source, provider, or private-data boundary
changed.

## Recurrence history

- 2026-07-30T17:33:36.523737Z: First observed.
