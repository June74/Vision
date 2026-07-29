# SB-20260729-173841-task6-yaml-parser-absent: Optional workflow parser dependency was absent

- **Status:** closed
- **First observed:** 2026-07-29T17:38:41Z
- **Last observed:** 2026-07-29T17:38:41Z
- **Phase/task:** Phase B acceptance instrumentation Task 6 review fixes
- **Environment:** Local Phase B linked worktree
- **Version/commit:** `fa650ad`

## Symptom

An optional independent `require("yaml")` workflow parse probe failed because
the repository does not install that package.

## Impact

The extra parser probe did not run. The repository workflow policy tests had
already passed. No provider, database, browser, runtime, dependency, or
external state changed.

## Reproduction conditions and safe evidence

Node reported `Cannot find module 'yaml'` from the read-only evaluation command.

## Attempts and outcomes

- The optional parser probe failed before reading workflow structure.
- The focused workflow policy suite had already passed its checkout, proof,
  adjacency, provider-state, operation, and rollback assertions.

## Cause classification

- **Confirmed cause:** The optional parser package is not a repository
  dependency.
- **Hypotheses:** None.
- **Known exclusions:** This was not a workflow-policy assertion failure.

## Correction and prevention

- **Correction:** Rely on the repository's passing workflow policy suite and do
  not add a production dependency solely for this review probe.
- **Prevention:** Check manifest availability before invoking optional parser
  libraries.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** GitHub's own workflow parser remains part of the
  future live dispatch path.

## Verification and related work

The final report records local workflow policy coverage and that no live
dispatch was performed in this review-fix task.
