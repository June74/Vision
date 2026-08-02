# SB-20260731-215653-task5-assumed-plan-directories: Task 5 discovery assumed absent plan directories

- **Status:** contained
- **First observed:** 2026-07-31T21:56:53.3451279Z
- **Last observed:** 2026-08-02T02:07:49.4937561Z
- **Phase/task:** Phase B Task 7 publication exact-candidate review
- **Environment:** Local Phase B worktree
- **Version/commit:** 84f3a0a

## Symptom

A read-only discovery command tried to list `docs/plans` and
`docs/specifications`, but neither assumed directory exists in this worktree.

## Impact

The command exited before locating the frozen plan. No source, test, staging,
provider, network, database, deployment, or external state changed.

## Cause classification

- **Confirmed cause:** Repository structure was inferred from a convention
  rather than from tracked paths.
- **Known exclusions:** No plan content was missed or modified.

## Correction and prevention

- **Correction:** Search tracked Markdown filenames for the exact Task 5 plan
  wording, then read only the confirmed files.
- **Prevention:** Discover tracked paths before assuming documentation folders.
- **Owner:** Codex.
- **Next diagnostic step:** Run a bounded tracked-file search.

## Recurrence history

- 2026-07-31T21:56:53.3451279Z: Contained before implementation work began.
- 2026-07-31T22:14:54.1781132Z: Recurred when the browser-package reviewer
  guessed `.superpowers/plans` and `.superpowers/specs`; this worktree keeps
  those authoring documents under `docs/superpowers`. The read-only listing
  changed nothing and review resumes from confirmed paths.
- 2026-07-31T22:45:09.5273933Z: Recurred at Task 6 discovery when a bounded
  `Select-String` command included the absent `docs/plans` path. No write or
  external action occurred; discovery resumes from tracked Markdown paths.
- 2026-07-31T21:09:02.7992490-05:00: Recurred when the Task 7 continuation
  equality check inferred the older 2026-07-28 authoring pair instead of
  confirming the 2026-07-29 paths from the authoring commit. The false check
  changed no repository or external state. The corrected check uses the exact
  plan and specification paths listed by that commit.
- 2026-08-02T02:07:49.4937561Z: Recurred when the publication reviewer guessed
  `docs/plans` while the supplied frozen authorities are under
  `docs/superpowers/plans` and `docs/superpowers/specs`. The read-only lookup
  changed no state and the review was stopped before verdict so this recurrence
  could enter the refrozen candidate. The retry must use the supplied exact
  paths without directory inference.
