# SB-20260801-194714-task7-task3-graph-fix-first-green: Task 3 graph-test fix remained red

- **Status:** closed
- **First observed:** 2026-08-01T19:47:14.969070Z
- **Last observed:** 2026-08-01T19:50:36.2310279Z
- **Phase/task:** Phase B Task 7 correlation repair Task 3 graph fix
- **Environment:** Local isolated Phase B worktree and repository-local Vitest shim
- **Version/commit:** Uncommitted repair based on `10b228bc2c18647f6a8a19c2dd5ad740e7f7491e`

## Symptom

The first graph-test fix run failed because textual action counting escaped the selection-job scope and a mutation helper threw when the pinned action was intentionally missing.

## Impact

Typecheck and report update were paused. Changes remain limited to two approved tests; no production, workflow, provider, live, deployment, staging, or commit state changed.

## Reproduction conditions

Count pinned upload actions across the whole workflow rather than only the
selection job, and let the mutation predicate call a throwing reader when the
action is intentionally absent.

## Safe evidence

- The first run produced two failures in the textual workflow test.
- One count saw legitimate upload uses outside selection.
- One missing-action mutation escaped through the helper instead of returning
  an invalid result.
- After correction, both workflow test files passed all 35 tests and canonical
  typecheck reported zero diagnostics.

## Attempts and outcomes

- Root reproduced both failures and localized their exact assertions.
- A narrow correction scoped action counting to the selection job and caught
  reader failure inside the mutation predicate.
- Root reran both files and canonical typecheck.

## Cause classification

- **Confirmed cause:** The new textual helpers used the wrong structural scope
  and an exception-throwing reader where a Boolean validator was required.
- **Hypotheses:** None remain.
- **Rejected hypotheses:** The workflow itself did not contain a duplicate
  selection upload or unsafe missing dependency.
- **Known exclusions:** No production, workflow YAML, provider, network, secret,
  deployment, live, staging, or commit state changed.

## Correction and prevention

- **Correction:** Count exact pinned uses only within selection and convert
  deliberate reader failures into invalid mutation results.
- **Prevention:** Textual workflow assertions must first isolate the job body,
  and mutation predicates must be total over every intentional mutation.
- **Owner:** Codex.
- **Next diagnostic step:** Complete subprocess-level verifier tests.

## Verification and related work

Closed after 35 of 35 focused graph tests and zero-diagnostic typecheck passed.

## Recurrence history

- 2026-08-01T19:47:14.969070Z: First observed.
