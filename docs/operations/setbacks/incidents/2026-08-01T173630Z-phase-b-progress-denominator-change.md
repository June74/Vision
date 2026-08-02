# Setback SB-20260801-173630-phase-b-progress-denominator-change

- **Status:** closed
- **Detected:** 2026-08-01T17:36:30.1565168Z
- **Last observed:** 2026-08-01T17:36:30.1565168Z
- **Scope:** Phase B owner progress reporting
- **Version/commit:** 10b228bc2c18647f6a8a19c2dd5ad740e7f7491e plus unstaged setback records

## What happened

Progress was previously described as 80–85 percent using an
implementation-and-infrastructure estimate. A later answer reported roughly 70
percent using equal completion of seven out of ten frozen tasks, without
disclosing that the denominator and weighting had changed.

## Impact

No project work regressed, but the inconsistent measurement implied that Phase
B had moved backward and reduced the owner's ability to judge schedule and
risk accurately.

## Cause classification

- **Confirmed cause:** Two different progress models were presented as if they
  were the same metric.
- **Rejected hypothesis:** No accepted code, deployment, migration, or live
  evidence was lost or reversed.

## Correction and prevention

- **Correction:** Report both stable measures: implementation readiness and
  frozen Phase B exit-gate completion. Always identify the denominator.
- **Prevention:** Use immutable completed-task reports for gate completion and
  never silently replace a prior percentage model. Prefer exact completed and
  remaining gates over an unsupported single percentage.
- **Owner:** Codex.
- **Next diagnostic step:** None; the reporting model is corrected below.

## Verification

Current local evidence has Task 1 through Task 7 reports and no Task 8, Task 9,
or Task 10 report. The admitted Task 7 commit remains unchanged. Therefore the
change was in reporting only, not project state.
