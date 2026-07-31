# SB-20260731-142319-task7-preflight-status-wildcard: Task 7 preflight treated the untracked marker as a wildcard

- **Status:** closed
- **First observed:** 2026-07-31T14:23:19.4886949Z
- **Last observed:** 2026-07-31T14:26:45.4648822Z
- **Phase/task:** Phase B Task 7 Gate 0 and candidate-freeze preflight
- **Environment:** Delegated read-only Git-status classification
- **Version/commit:** c5de12d plus unstaged Task 3 repair and setback ledger

## Symptom

A PowerShell wildcard comparison interpreted Git's untracked status marker as
wildcard characters, invalidating the computed untracked-path count.

## Impact

Only that aggregate count is invalid. The Task 7 preflight paused before using
it as evidence.

## Reproduction conditions

Classify the untracked status prefix with PowerShell wildcard matching instead
of literal prefix comparison.

## Safe evidence

The reviewer returned one fixed classification-error category and a count of
one. No status paths, source, URI, credential, protected identifier, provider
value, argument stream, or environment value was emitted.

## Attempts and outcomes

- Other prerequisite and artifact observations remain valid.
- No repository, Git, provider, network, or external state changed.

## Cause classification

- **Confirmed cause:** The untracked marker has wildcard meaning under the
  selected PowerShell operator.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Git did not return malformed status data.
- **Known exclusions:** No paths or sensitive data were exposed.

## Correction and prevention

- **Correction:** Recompute the aggregate with literal-prefix matching.
- **Prevention:** Treat version-control status markers as literal text, never
  patterns.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Complete the read-only Task 7 preflight with the
  corrected count.

## Verification and related work

Literal-prefix classification produced the valid tracked, untracked, and
staged aggregate counts used by the completed Task 7 preflight.

## Recurrence history

- 2026-07-31T14:23:19.4886949Z: First observed and contained with zero state
  change.
- 2026-07-31T14:26:45.4648822Z: Closed after literal classification completed
  the bounded status audit.
