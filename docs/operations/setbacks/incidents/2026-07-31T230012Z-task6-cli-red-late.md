# SB-20260731-230012-task6-cli-red-late: Cleanup CLI helper preceded its focused RED

- **Status:** closed
- **First observed:** 2026-07-31T23:00:12.1912445Z
- **Last observed:** 2026-07-31T23:05:54.2645503Z
- **Phase/task:** Phase B live-closure Task 6 cleanup inventory
- **Environment:** Local Phase B worktree
- **Version/commit:** current uncommitted Task 6 package

## Symptom and impact

The cleanup inventory's CLI helper and direct-execution branch were written
after the module-level RED but before a focused assertion exercised the exact
CLI argument and output contract. No live, provider, network, database,
deployment, deletion, or private-data action occurred.

## Cause classification

- **Confirmed cause:** The missing-module RED was incorrectly treated as
  covering every later export in the new module.
- **Hypothesis:** None.
- **Rejected hypothesis:** Typecheck and module-level GREEN do not prove the
  exact CLI contract.
- **Known exclusions:** The inventory map and Task 9 manifest had focused RED
  coverage; only the CLI seam lacked its own observed RED.

## Correction and prevention

- **Correction:** Remove the untested CLI helper, add its focused tests, observe
  the missing-export RED, then restore the smallest implementation and rerun.
- **Prevention:** List every new exported seam in the RED checklist before
  creating a multi-interface module.
- **Owner:** Codex.
- **Next diagnostic step:** Run the focused cleanup suite with the CLI helper
  temporarily absent.

## Verification and related work

The focused RED failed only because `runCleanupInventoryCli` was absent. After
the minimal implementation was restored, the combined cleanup/closure suite
passed 2 files and 19 tests, and both TypeScript projects passed.

## Recurrence history

- 2026-07-31T23:04:17.1985061Z: The context-free CLI restoration patch placed
  its two imports after executable module code. Focused runtime tests passed,
  but the layout violates the intended module-documentation boundary. No
  external state changed; move the imports to the top before rerunning gates.
- 2026-07-31T23:05:54.2645503Z: Imports were moved below the module JSDoc and
  before declarations. The 19-test focused suite, both TypeScript projects,
  documentation coverage, and release security scan all passed.
