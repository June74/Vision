# SB-20260731-142820-task3-canonical-focused-report-missing: Canonical focused run exited without structured report

- **Status:** closed
- **First observed:** 2026-07-31T14:28:20.4759300Z
- **Last observed:** 2026-07-31T14:31:18.1189588Z
- **Phase/task:** Phase B Task 3 canonical combined verification
- **Environment:** Main Phase B worktree; captured Vitest invocation
- **Version/commit:** c5de12d plus unstaged controller and resolver repairs

## Symptom

The first canonical combined focused-test command exited nonzero and produced no
structured JSON report.

## Impact

No combined root verification result exists yet. The independent resolver and
controller GREEN results remain prior evidence but do not replace this gate.

## Reproduction conditions

Invoke the three-file focused group through the initial captured reporter
command shape.

## Safe evidence

Only the exit category and sentinel report counts were emitted. The captured
runner stream was deleted without rendering. No source, assertion payload,
URI, credential, protected identifier, provider value, argument stream, or
environment value was exposed.

## Attempts and outcomes

- Process exit was nonzero.
- No structured report file was produced.
- Exact temporary capture/report paths were removed after containment.

## Cause classification

- **Confirmed cause:** Pending; command/reporter routing must be separated from
  test execution.
- **Hypotheses:** The project selector or output-file argument may not match the
  repository's Vitest invocation contract.
- **Rejected hypotheses:** No individual test failure is proven by the missing
  report.
- **Known exclusions:** No source, Git, provider, network, or external state
  changed.

## Correction and prevention

- **Correction:** Use the repository's already validated focused invocation
  shape, capture streams privately, and emit only exit/test counts.
- **Prevention:** Validate reporter/project routing on one known test file
  before combining focused files.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Classify command routing versus suite collection
  without emitting raw runner output.

## Verification and related work

The direct local Vitest entry point passed first for the complete controller
file and then for the combined resolver, controller, and workflow focused
group. Captured output remained private and was deleted after each run.

## Recurrence history

- 2026-07-31T14:28:20.4759300Z: First observed and contained; no structured
  test evidence was accepted.
- 2026-07-31T14:30:09.8548258Z: A one-file routing check without the incorrect
  project selector also exited before producing its structured report. This
  rejects the selector as the sole cause and narrows diagnosis to the package
  entry point or JSON reporter/output-file shape. Captured output was deleted
  without rendering; no state changed.
- 2026-07-31T14:31:18.1189588Z: Closed after the validated direct binary passed
  both the one-file routing check and the complete three-file focused group.
