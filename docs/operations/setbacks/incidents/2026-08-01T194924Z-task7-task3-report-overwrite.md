# SB-20260801-194924-task7-task3-report-overwrite: Task 3 graph correction overwrote prior report evidence

- **Status:** closed
- **First observed:** 2026-08-01T19:49:24.234164Z
- **Last observed:** 2026-08-01T19:50:36.2310279Z
- **Phase/task:** Phase B Task 7 correlation repair Task 3 graph fix
- **Environment:** Ignored local SDD evidence in the isolated Phase B worktree
- **Version/commit:** Uncommitted repair based on `10b228bc2c18647f6a8a19c2dd5ad740e7f7491e`

## Symptom

The graph-correction agent replaced the ignored Task 3 report with a shorter file, dropping the earlier RED, implementation, focused totals, and five-file scope history.

## Impact

Tracked source and tests remain valid, but the local evidence report is incomplete until restored. No provider, live, deployment, staging, or commit state changed.

## Reproduction conditions

Replace the existing report with a task-local summary instead of appending the
new correction evidence to the full Task 3 lifecycle report.

## Safe evidence

- The overwritten report retained the latest graph correction but omitted the
  initial RED, implementation contract, full five-file scope, and pending
  subprocess boundary.
- The restored report contains both the TDD and independent-review repair
  sections.
- Focused graph tests and typecheck remained green after restoration.

## Attempts and outcomes

- Root stopped further task work and rebuilt one consolidated report through
  `apply_patch`.
- Root validated both required report headings, 35 focused graph tests, and
  canonical typecheck.

## Cause classification

- **Confirmed cause:** The narrow correction treated the shared Task 3 report
  as a fresh per-subtask file rather than append-only lifecycle evidence.
- **Hypotheses:** None remain.
- **Rejected hypotheses:** No tracked source or test evidence was lost.
- **Known exclusions:** No provider, network, secret, deployment, live, staging,
  or commit state changed.

## Correction and prevention

- **Correction:** Restore one consolidated report containing original TDD,
  implementation, review repairs, residual risk, and complete scope.
- **Prevention:** Subtask briefs must say append/update the existing lifecycle
  report and forbid replacement; validate required prior headings afterward.
- **Owner:** Codex.
- **Next diagnostic step:** Append subprocess verification results without
  replacing prior sections.

## Verification and related work

Closed after the restored report passed required-heading checks while the graph
suite and typecheck remained green.

## Recurrence history

- 2026-08-01T19:49:24.234164Z: First observed.
