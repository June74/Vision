# SB-20260729-235432-final-report-probe-errors: Final report probe used invalid PowerShell assumptions

- **Status:** closed
- **First observed:** 2026-07-29T23:54:32Z
- **Last observed:** 2026-07-29T23:54:32Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 2
- **Environment:** Local Phase B worktree
- **Version/commit:** Post-implementation reporting after `8bf5d4a`

## Symptom

The first ignored-report probe placed a pipeline directly after a `foreach`
statement, which PowerShell rejected as an empty pipe element. A follow-up
directory probe also assumed that setbacks lived under `.superpowers`, while
this repository stores them under `docs/operations/setbacks/incidents`.

## Impact

Neither read-only probe changed application files, Git state, generated
artifacts, provider state, or production state. The reporting handoff was
briefly delayed.

## Cause classification

- **Confirmed cause:** The diagnostic command used invalid PowerShell pipeline
  structure and then an unverified directory assumption.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The errors were not caused by the implementation,
  tests, Git commit, or sandbox permissions.
- **Known exclusions:** No deployment or external service call occurred.

## Correction and prevention

- **Correction:** Build an explicit result array before conversion to JSON and
  discover repository paths before probing them.
- **Prevention:** Keep PowerShell collection pipelines outside compound
  statements and verify repository-specific operational paths with a
  non-recursive directory check first.
- **Owner:** Codex and project owner.

## Verification and related work

The probes were read-only, and the final repository-state audit is rerun after
the ignored reports are updated.

## Recurrence history

- 2026-07-29T23:54:32Z: First observed and corrected.
