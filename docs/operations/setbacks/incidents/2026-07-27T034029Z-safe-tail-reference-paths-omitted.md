# SB-20260727-034029-safe-tail-reference-paths-omitted: Safe-tail reference updates were omitted

- **Status:** closed
- **First observed:** 2026-07-27T03:40:29Z
- **Last observed:** 2026-07-28T02:21:26.5488258Z
- **Phase/task:** Preview database role probe Task 1 full gate
- **Environment:** Local Phase B worktree
- **Version/commit:** `e177170`

## Symptom

The Task 2 documentation gate reported that the new safe-tail classifier and
its helper functions lacked mirrored simple and technical headings.

## Impact

Runtime and type checks were unaffected, but the task did not satisfy the
repository documentation contract and was stopped before commit. No provider
or private state changed.

## Reproduction conditions

Add named functions to the safe-tail classifier while updating only the
scheduler reference pages, then run the documentation coverage gate.

## Safe evidence

The gate listed eight local function names and their missing simple and
technical headings. It rendered no secret or provider-controlled value.

## Attempts and outcomes

- The first documentation gate failed with only missing-reference findings.
- The exact existing safe-tail reference pages were then resolved from the
  repository.
- Both reference pages were updated, and the documentation gate passed.

## Cause classification

- **Confirmed cause:** The task file list omitted the existing safe-tail
  reference pages even though the binding global documentation constraint
  applies to every new named function.
- **Hypotheses:** None.
- **Rejected hypotheses:** Scheduler reference updates alone are not sufficient
  for script function coverage.
- **Known exclusions:** Source JSDoc was present and the scheduler reference
  pages were updated.

## Correction and prevention

- **Correction:** Add concise mirrored headings to the existing safe-tail
  simple and technical reference pages.
- **Prevention:** Run documentation coverage immediately after adding named
  helpers and reconcile task file lists with binding repository-wide rules.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

`pnpm.cmd docs:check` exited zero after the mirrored headings were added.

## Recurrence history

- 2026-07-27T03:40:29Z: First observed and contained before commit.
- 2026-07-28T02:21:26.5488258Z: Recurred when the returned scheduler
  dependency method `probeRole` lacked source JSDoc and matching simple and
  technical scheduled-reference headings. TypeScript, unit, contract, and
  Worker gates had passed; no provider or private state changed.
