# SB-20260731-165506-candidate-lane-owned-path-mismatch: Candidate repair assignment named two nonexistent modules

- **Status:** closed
- **First observed:** 2026-07-31T16:55:06.0345866Z
- **Last observed:** 2026-07-31T16:55:06.0345866Z
- **Phase/task:** Phase B Task 3 fourth-wave candidate lifecycle repair
- **Environment:** Shared-worktree repair preflight
- **Version/commit:** 752b81f

## Symptom

The candidate repair assignment named two inferred lifecycle modules that do
not exist in the worktree.

## Impact

The lane stopped before edits. No provider, network, deployment, secret,
protected output, or external mutation occurred.

## Cause classification

- **Confirmed cause:** The controller inferred filenames instead of verifying
  the live repository paths before assigning ownership.
- **Hypotheses:** None remaining.
- **Known exclusions:** The intended live paths were present and unchanged.

## Correction and prevention

- **Correction:** Replace the nonexistent names with the verified existing
  preparation and rollback-lifecycle validator modules and their direct tests
  and references.
- **Prevention:** Validate every delegated owned path with exact existence
  checks before dispatch.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Recurrence history

- 2026-07-31T16:55:06.0345866Z: First observed and closed after exact path
  existence checks identified both replacements.
