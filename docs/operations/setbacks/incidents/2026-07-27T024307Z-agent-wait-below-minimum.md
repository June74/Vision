# SB-20260727-024307-agent-wait-below-minimum: Agent wait used a duration below the tool minimum

- **Status:** closed
- **First observed:** 2026-07-27T02:43:07Z
- **Last observed:** 2026-07-27T02:43:07Z
- **Phase/task:** Phase B restore orchestration
- **Environment:** Codex agent coordination
- **Version/commit:** `574ea0a`

## Symptom

One mailbox wait requested one second even though the coordination tool
requires at least ten seconds.

## Impact

The wait was rejected immediately. No subagent, file, provider, or runtime
state changed.

## Reproduction conditions

Call the coordination wait with a duration below its documented minimum.

## Safe evidence

The tool returned only the minimum-duration validation error.

## Attempts and outcomes

- The one-second wait was rejected.
- Subsequent waits used valid durations.

## Cause classification

- **Confirmed cause:** The requested wait duration was below the tool's
  explicit minimum.
- **Hypotheses:** None.
- **Rejected hypotheses:** The implementer was not interrupted.
- **Known exclusions:** No product or provider action occurred.

## Correction and prevention

- **Correction:** Use ten seconds or longer for every coordination wait.
- **Prevention:** Treat the tool schema's minimum as a hard orchestration
  constant.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

A valid ten-second wait completed normally.

## Recurrence history

- 2026-07-27T02:43:07Z: First observed and corrected.
