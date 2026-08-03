# SB-20260803-200702-fix-brief-omitted-setback-index: Final-review fix brief omitted the setback index

- **Status:** resolved
- **First observed:** 2026-08-03T20:07:02.818512Z
- **Last observed:** 2026-08-03T20:07:02.818512Z
- **Phase/task:** Phase B TSX repair final-review fix
- **Environment:** Local documentation-only reconciliation in the Phase B worktree
- **Version/commit:** Reconciliation commit `2e3e8de`; index follow-up commit pending

## Symptom

The fix brief required a new incident but authorized staging only that incident and the stale-impact correction, leaving the helper-managed docs/operations/setbacks/INDEX.md update unstaged.

## Impact

The reconciliation commit contains the incident itself, but the tracked setback index is incomplete until a narrowly scoped follow-up commits the index row and this planning-error record.

## Reproduction conditions

Create an incident with the canonical setback helper, then constrain the
resulting commit to the incident file while omitting the helper-managed
`docs/operations/setbacks/INDEX.md` update.

## Safe evidence

- Commit `2e3e8de` contains the Task 2 reconciliation incident and the stale
  resolved-incident wording correction, but not the helper-managed index.
- The pending index diff includes the reconciliation incident row and this
  follow-up incident row.
- No runtime, provider, credential, database, calendar, backup-key, or other
  external state changed.

## Attempts and outcomes

1. The exact-two-file brief was followed and commit `2e3e8de` was verified to
   contain only its two authorized documentation files.
2. Final verification established that the incident's required index entry was
   still unstaged.
3. This scoped follow-up completes the incident contract and commits the
   existing helper-managed index with this planning-error record.

## Cause classification

- **Confirmed cause:** The exact-two-file fix brief omitted the required
  helper-managed setback index.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The index entry was optional after using the
  canonical incident helper.
- **Known exclusions:** No runtime, provider, credential, database, calendar,
  key, controller, or test state changed.

## Correction and prevention

- **Correction:** Commit the existing helper-managed `INDEX.md` update with
  this scoped follow-up incident.
- **Prevention:** Include `INDEX.md` in every new-incident stage scope and
  verify the incident file and its index row together before committing.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while resolved.

## Verification and related work

The follow-up runs the documentation and whitespace checks, stages exactly
`INDEX.md` and this incident, then verifies the commit path set and the range
whitespace check from `2e3e8de`.

## Recurrence history

- 2026-08-03T20:07:02.818512Z: First observed.
- 2026-08-03T20:07:02.818512Z: Resolved after the scoped index follow-up was
  prepared with no runtime or provider action.
