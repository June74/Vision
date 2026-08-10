# SB-20260803-051842-wait-agent-used-for-user-input: Agent mailbox wait was used while awaiting owner input

- **Status:** closed
- **First observed:** 2026-08-03T05:18:42.6108879Z
- **Last observed:** 2026-08-03T05:20:43.7132920Z
- **Phase/task:** Phase B monitored schedule-proof coordination
- **Environment:** Codex orchestration
- **Version/commit:** Candidate `c1911f8`; no mutation associated

## Symptom

The agent-mailbox wait mechanism was briefly used while awaiting the owner's
schedule confirmation, even though that mechanism is intended for subagent
updates rather than as the primary user-input channel.

## Impact

The wait timed out once and later happened to be interrupted by user input. It
did not alter the proof, controller, repository, or any external state.

## Safe evidence

Only timeout/interruption categories were returned. No user content, secret,
identifier, URL, or provider response was exposed.

## Cause classification

- **Confirmed cause:** The orchestration mechanism was selected for a purpose
  outside its primary role.
- **Known exclusions:** The later schedule proof used the owner's explicit
  message and fresh challenge, not the mailbox result.

## Correction and prevention

- **Correction:** Use direct commentary plus a dedicated filesystem challenge
  watcher; treat user messages as the sole schedule-confirmation evidence.
- **Prevention:** Reserve agent waits for agent mailboxes and do not use them as
  a substitute for user-input handling.
- **Owner:** Codex.

## Verification and related work

The monitored rerun used a dedicated challenge watcher and the owner's direct
confirmation. Incident closed.

## Recurrence history

- 2026-08-03T05:18:42.6108879Z: Misuse identified and corrected.
- 2026-08-03T05:20:43.7132920Z: The same wait mechanism was mistakenly reused
  once while awaiting rollback Booleans. Direct final handoff replaced it;
  incident remains closed after the recurrence correction.
