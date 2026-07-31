# SB-20260731-044935-task3-timeout-title-match-failure: Timeout diagnostic could not match the runner label to source

- **Status:** closed
- **First observed:** 2026-07-31T04:49:35.6472274Z
- **Last observed:** 2026-07-31T04:56:09.1738814Z
- **Phase/task:** Phase B Task 3 canonical full-gate diagnosis
- **Environment:** Main Phase B worktree; bounded captured-output parser
- **Version/commit:** 5f11f52

## Symptom

The first bounded parser found the one failure row but could not match its
formatted leaf label uniquely to a source test declaration.

## Impact

The exact timed-out case was not classified by that diagnostic. No raw label
was emitted, no file changed, and no external state changed.

## Reproduction conditions

Split the sanitized runner failure row on suite delimiters and match the final
segment literally against source without first removing runner-added metadata.

## Safe evidence

The matcher returned a source-title match count of zero and emitted no title,
stream, fixture, URI, identifier, or source excerpt.

## Attempts and outcomes

- The failure row was found safely.
- Literal leaf matching produced zero source matches.
- Further title-based matching stopped.

## Cause classification

- **Confirmed cause:** The runner-formatted leaf segment was not a literal
  source title.
- **Hypotheses:** Runner-added timing or formatting metadata prevented the
  match.
- **Rejected hypotheses:** The source file is not missing; it already passed
  all 28 tests independently.
- **Known exclusions:** No output exposure, mutation, or external action
  occurred.

## Correction and prevention

- **Correction:** Use structure and timing evidence rather than title matching,
  or normalize runner metadata before any future match.
- **Prevention:** Do not assume a formatted failure-label segment equals a
  source test title.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

Title matching was no longer needed. A unique sanitized stack location safely
identified the multi-process case at source line 499.

## Recurrence history

- 2026-07-31T04:49:35.6472274Z: First observed and contained with no emitted
  label or mutation.
- 2026-07-31T04:50:31.7286849Z: A second matcher compared every static source
  declaration against the sanitized failure row and again found zero matches.
  Title matching was abandoned in favor of controlled file-level timing
  evidence.
- 2026-07-31T04:56:09.1738814Z: Closed after a unique sanitized stack location
  identified the implicated source line without exposing the formatted label.
