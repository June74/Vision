# SB-20260803-191708-schedule-config-discovery-command-errors: Schedule configuration lookup used two faulty diagnostic commands

- **Status:** resolved
- **First observed:** 2026-08-03T19:17:08.520329Z
- **Last observed:** 2026-08-03T19:17:08.520329Z
- **Phase/task:** Phase B live rollback validation
- **Environment:** Local Windows PowerShell diagnostic commands
- **Version/commit:** Task 1 controller repair preparation

## Symptom

A recursive PowerShell file search entered a broken dependency path, and the first Git-based retry contained an invalid empty pipeline before the corrected bounded lookup succeeded.

## Impact

The errors delayed the manual schedule prompt but did not change files, provider state, or the validation result.

## Reproduction conditions

Use a broad recursive dependency-tree search, then an invalid first pipeline
that emits no grouped loop output before piping.

## Safe evidence

- The recursive search entered a broken dependency path.
- The first pipeline was invalid because its loop output was not grouped before
  piping.
- A bounded tracked-file lookup succeeded without provider access or mutation.

## Attempts and outcomes

1. A broad recursive dependency-tree search failed at a broken path.
2. The first Git-based retry used an invalid empty pipeline.
3. A bounded tracked-file lookup succeeded and supplied the needed schedule
   configuration evidence.

## Cause classification

- **Confirmed cause:** Broad dependency-tree recursion entered a broken path,
  and the first pipeline failed because PowerShell loop output was not grouped
  before piping.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The schedule configuration was unavailable in the
  tracked files.
- **Known exclusions:** No files, provider state, or validation result changed
  during the failed diagnostic commands.

## Correction and prevention

- **Correction:** Used a bounded tracked-file lookup.
- **Prevention:** Avoid broad dependency-tree recursion and group PowerShell
  loop output before piping.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None for this incident.

## Verification and related work

The bounded tracked-file lookup completed successfully and provided the
required local configuration evidence.

## Recurrence history

- 2026-08-03T19:17:08.520329Z: First observed.
- 2026-08-03: Corrected bounded lookup succeeded; incident resolved.
