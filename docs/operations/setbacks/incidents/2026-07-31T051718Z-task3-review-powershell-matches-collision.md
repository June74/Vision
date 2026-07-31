# SB-20260731-051718-task3-review-powershell-matches-collision: Workflow review accumulator collided with PowerShell Matches

- **Status:** closed
- **First observed:** 2026-07-31T05:17:18.1672073Z
- **Last observed:** 2026-07-31T05:26:43.5989902Z
- **Phase/task:** Phase B Task 3 final workflow review
- **Environment:** Read-only reviewer; Windows PowerShell
- **Version/commit:** Frozen review package through 280c7ab

## Symptom

A reviewer helper used `$matches` as an accumulator. PowerShell variable names
are case-insensitive, so this collided with the automatic `$Matches` hash
table and produced repeated hash-table addition errors.

## Impact

The workflow review's local summary was not created and the review was delayed.
No package, source, provider, Git, or external state changed.

## Reproduction conditions

Assign an accumulator to `$matches`, execute regular-expression matches that
populate automatic `$Matches`, and then use array-style addition.

## Safe evidence

Only the PowerShell type-error category was returned. No package content,
credential, URI, protected identifier, provider value, or external state was
emitted.

## Attempts and outcomes

- The read-only helper failed before producing its summary.
- The reviewer stopped and reported the confirmed variable collision.

## Cause classification

- **Confirmed cause:** Case-insensitive collision with PowerShell's automatic
  `$Matches` variable changed the accumulator into a hash table.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The authorized package is present and readable.
- **Known exclusions:** No mutation, provider access, or sensitive output
  occurred.

## Correction and prevention

- **Correction:** Use a nonreserved typed list or array name and retain bounded
  output.
- **Prevention:** Never use PowerShell automatic-variable names, in any casing,
  for task-local state.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The reviewer resumed with nonreserved bounded state and completed the
package-only workflow review without another variable collision.

## Recurrence history

- 2026-07-31T05:17:18.1672073Z: First observed and contained before any
  summary or mutation.
- 2026-07-31T05:26:43.5989902Z: Closed after the corrected reviewer completed
  its bounded package review.
