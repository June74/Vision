# SB-20260802-060525-design-spec-preflight-sandbox-acl: Sandbox rejected design-spec preflight batch

- **Status:** closed
- **First observed:** 2026-08-02T06:05:25.2019160Z
- **Last observed:** 2026-08-02T06:06:26.8536053Z
- **Phase/task:** Phase B Task 8 reconnect-recovery design specification
- **Environment:** Local Windows workspace sandbox
- **Version/commit:** Approved option 1 work based on `e283410`

## Symptom

A parallel batch of read-only skill, repository-status, specification-inventory,
and recent-commit checks was rejected while the sandbox applied deny-read ACLs.

## Impact

Design-spec preparation paused before any command result was returned. No file,
Git index, application, database, provider, credential, calendar, or key state
changed.

## Reproduction conditions

Submit the five independent read-only preflight commands in one sandboxed
orchestration batch on this Windows workspace.

## Safe evidence

The orchestrator returned only a sandbox helper category. No command output,
private data, identifier, URL, credential, or provider value was returned.

## Attempts and outcomes

- The combined read-only batch was rejected before usable output.
- Each required skill, specification inventory, Git status, and recent-history
  read succeeded when retried individually.

## Cause classification

- **Confirmed cause:** The Windows sandbox helper rejected the batched command
  while applying its read restrictions.
- **Hypothesis:** None remaining.
- **Rejected hypothesis:** Repository permissions or missing files caused the
  failure; every equivalent individual read succeeded immediately afterward.
- **Known exclusions:** Repository content, Git ownership, provider state, and
  credentials were not evaluated by the rejected batch.

## Correction and prevention

- **Correction:** Retry the required reads individually or in smaller batches.
- **Prevention:** Keep sandboxed preflight batches small when they span both
  user skill roots and linked-worktree Git reads.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

All equivalent bounded reads succeeded individually without state change.

## Recurrence history

- 2026-08-02T06:05:25.2019160Z: First observed and contained before any
  repository or external-state action.
- 2026-08-02T06:06:26.8536053Z: Closed after the same bounded reads succeeded
  individually and confirmed the repository remained unchanged apart from the
  required setback record.
