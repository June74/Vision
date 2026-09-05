# SB-20260803-192241-tsx-design-spec-trailing-whitespace: Design specification failed staged whitespace validation

- **Status:** resolved
- **First observed:** 2026-08-03T19:22:41.361232Z
- **Last observed:** 2026-09-04 local
- **Phase/task:** Phase B controller repair design
- **Environment:** Local Git staged whitespace validation
- **Version/commit:** design-only commit `3ecacc6`

## Symptom

The staged TSX adapter design specification contained two trailing spaces after its date line, and git diff --check rejected it.

## Impact

No code or provider state changed; the specification must be corrected and restaged before its design-only commit.

## Reproduction conditions

Stage the design specification with trailing spaces on its date line, then run
`git diff --cached --check`.

## Safe evidence

- The date line contained two trailing spaces.
- The trailing spaces were removed.
- `git diff --cached --check` succeeded before design-only commit `3ecacc6`.

## Attempts and outcomes

1. Staged whitespace validation identified the two trailing spaces on the date
   line.
2. The spaces were removed and the exact staged check succeeded before commit.

## Cause classification

- **Confirmed cause:** The date line contained two trailing spaces.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The design specification had no staged whitespace
  errors.
- **Known exclusions:** No code or provider state changed.

## Correction and prevention

- **Correction:** Removed the date-line trailing spaces and re-ran staged
  whitespace validation.
- **Prevention:** Require `git diff --cached --check` before documentation-only
  commits.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None for this incident.

## Verification and related work

`git diff --cached --check` succeeded before commit `3ecacc6`.

## Recurrence history

- 2026-08-03T19:22:41.361232Z: First observed.
- 2026-08-03: Date-line trailing spaces removed and staged check passed;
  incident resolved.

## Phase C predicate-diagnostic recurrence

Staged validation caught one extra blank line at the end of the new approved
design document. The unstaged check had not included the then-untracked file.
The commit stopped before any push or deployment. The blank line was removed;
the exact staged check must pass before committing. A first note patch used an
incomplete heading and matched nothing; the corrected patch uses the observed
recurrence context. These were documentation-only issues, not application changes.
Prevention: check newly added files after staging, not only the working-tree diff.

The corrected staged whitespace check and documentation coverage both passed.
The recurrence is resolved; no runtime, secret, or live database change resulted.
