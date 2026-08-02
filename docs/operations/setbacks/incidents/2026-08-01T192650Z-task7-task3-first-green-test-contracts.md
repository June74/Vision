# SB-20260801-192650-task7-task3-first-green-test-contracts: Task 3 first GREEN exposed three test-contract defects

- **Status:** closed
- **First observed:** 2026-08-01T19:26:50.293690Z
- **Last observed:** 2026-08-01T19:26:56.5713260Z
- **Phase/task:** Phase B Task 7 correlation repair Task 3
- **Environment:** Local isolated Phase B worktree and repository-local Vitest shim
- **Version/commit:** Uncommitted repair based on `10b228bc2c18647f6a8a19c2dd5ad740e7f7491e`

## Symptom

The first post-implementation run remained red because one cleanup test matched a suffix instead of the fixed path, one workflow test treated an input name as a job, and one helper consumed the workflow tail when the upload was last.

## Impact

Task 3 acceptance was delayed. Corrections stayed in the three approved tests; production, provider, live, secret, deployment, and commit state did not change beyond the approved implementation.

## Reproduction conditions

Add the approved workflow artifact at the end of the selection steps and run
the first post-implementation focused suite against the initial RED helpers.

## Safe evidence

- The cleanup classifier compared a suffix rather than the exact fixed path.
- A workflow-input key was admitted by a job-name matcher.
- The selection-step helper lacked an end-of-job boundary when the upload was
  the final step.
- After test-only corrections, all 51 focused tests and canonical typecheck
  passed.

## Attempts and outcomes

- The first implementation run demonstrated the three helper defects.
- Each correction remained in its originating approved test file.
- The complete focused suite and typecheck were rerun after the corrections.

## Cause classification

- **Confirmed cause:** Three new assertions encoded assumptions about exact
  paths, YAML section boundaries, and final-step slicing that did not match the
  repository's actual structures.
- **Hypotheses:** None remain.
- **Rejected hypotheses:** The artifact ordering, evidence file, and fixed CLI
  production contracts did not require weakening.
- **Known exclusions:** No provider, network, secret, calendar, database, R2,
  deployment, workflow dispatch, backup-key, staging, or commit action occurred.

## Correction and prevention

- **Correction:** Classify the exact fixed path, parse only actual job headings,
  and bound the final selection step by the job end when no next step exists.
- **Prevention:** RED helper code must be validated against the parsed artifact
  structure, including end-of-list cases, before production behavior is blamed.
- **Owner:** Codex.
- **Next diagnostic step:** Independent Task 3 spec and quality review.

## Verification and related work

Closed after all 51 focused tests and canonical typecheck passed without
weakening the approved production contract.

## Recurrence history

- 2026-08-01T19:26:50.293690Z: First observed.
