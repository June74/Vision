# SB-20260731-144704-task3-final-review-agent-name-collision: Final workflow reviewer reused a reserved agent name

- **Status:** closed
- **First observed:** 2026-07-31T14:47:04.3928201Z
- **Last observed:** 2026-07-31T14:47:51.2099390Z
- **Phase/task:** Phase B Task 3 final package re-review
- **Environment:** Multi-agent review orchestration
- **Version/commit:** 73191b7

## Symptom

The second fresh reviewer creation reused a name still reserved by an older
completed reviewer entry, and orchestration rejected the spawn.

## Impact

Only one of the three intended fresh reviewers started in that dispatch wave.
No review result was lost or misattributed.

## Reproduction conditions

Spawn a new reviewer using a canonical task name already present in the thread
registry, even if the earlier task is no longer visible in the current short
agent list.

## Safe evidence

The orchestration layer returned only the name-collision category. No package
content, URI, credential, protected identifier, provider value, environment
value, repository mutation, or external action occurred.

## Attempts and outcomes

- The lifecycle reviewer started successfully under a unique name.
- The workflow reviewer did not start.

## Cause classification

- **Confirmed cause:** Reviewer task names remain reserved across earlier
  completed entries.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** No concurrency-slot or package-access failure was
  indicated.
- **Known exclusions:** No review finding exists from the rejected spawn.

## Correction and prevention

- **Correction:** Retry with a timestamp-distinct reviewer name.
- **Prevention:** Include a unique wave suffix on every final-review task name.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Start the missing workflow reviewer under a unique
  name, then start the security reviewer.

## Verification and related work

Timestamp-distinct names started both the missing workflow reviewer and the
security reviewer. Together with the already running lifecycle reviewer, the
three-reviewer wave is active.

## Recurrence history

- 2026-07-31T14:47:04.3928201Z: First observed and contained; no reviewer was
  created under the colliding name.
- 2026-07-31T14:47:51.2099390Z: Closed after both missing reviewers started
  successfully with unique wave names.
