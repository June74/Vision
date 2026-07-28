# SB-20260727-131823-required-report-ignored-by-git: Required implementation report matched an ignored path

- **Status:** closed
- **First observed:** 2026-07-27T13:18:23Z
- **Last observed:** 2026-07-28T21:43:15.6799232Z
- **Phase/task:** Phase B restore Task 4 tail correction
- **Environment:** Local repository staging
- **Version/commit:** Task report bookkeeping commit `3257771`

## Symptom

The required task report matched an ignored repository path and was omitted from a normal stage command.

## Impact

The report remained present locally but was not included in the first quiet documentation commit.

## Reproduction conditions

Stage the task-report path without an explicit force option.

## Safe evidence

- Git reported that the task-report directory is ignored.
- No provider data, secrets, or runtime configuration was involved.

## Attempts and outcomes

1. Normal staging omitted the required report.
2. The report was force-staged explicitly in its required bookkeeping commit.

## Cause classification

- **Confirmed cause:** Repository ignore rules cover the task-report directory.
- **Hypotheses:** None open.
- **Rejected hypotheses:** The report file was not missing.
- **Known exclusions:** No source, credential, provider, or deployment state changed.

## Correction and prevention

- **Correction:** Force-stage only the required report path.
- **Prevention:** Check ignore rules before staging mandatory task reports.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

- The required report was force-staged and committed in `3257771`.

## Recurrence history

- 2026-07-28T21:43:15.6799232Z: Task 3 review-fix staging named the ignored
  handoff report alongside tracked source, tests, references, and setback
  records. Git returned the ignored-path category after staging the tracked
  paths. The controller clarified that current SDD reports remain local
  scratch artifacts; the report is left present but excluded from the fix
  commit. No source, provider, or private state changed.
