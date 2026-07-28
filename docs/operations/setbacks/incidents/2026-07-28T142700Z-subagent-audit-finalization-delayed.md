# SB-20260728-142700-subagent-audit-finalization-delayed: Audit finalization was delayed

- **Status:** closed
- **First observed:** 2026-07-28T14:21:00Z
- **Last observed:** 2026-07-28T18:38:44Z
- **Phase/task:** Phase B acceptance instrumentation plan final review
- **Environment:** Local subagent coordination
- **Version/commit:** `386b7d3`

## Symptom

Both read-only audit workers had already reported their safe conclusions but
did not return their required report artifacts within repeated bounded waits.

## Impact

The user-facing handoff was delayed. No provider, repository, credential,
database, R2, deployment, restore, secret, or key state changed.

## Reproduction conditions and safe evidence

Request final report completion after each worker has already produced a safe
conclusion. The workers remain active without creating their report file during
the bounded interval.

## Cause classification

- **Confirmed cause:** Report finalization did not complete within the bounded
  coordination window.
- **Hypotheses:** A pending tool or overly broad final report assembly delayed
  each worker.
- **Rejected hypotheses:** Missing audit conclusions; both had already returned
  their decisive safe findings.
- **Known exclusions:** No private value or external mutation was involved.

## Attempts and outcomes

1. Bounded waits and concise finalize messages produced no report.
2. Each worker was interrupted after its safe conclusion.
3. Each was re-dispatched with a report-only instruction and no further
   provider work.
4. Both required safe report files were created and final statuses returned.

## Correction and prevention

- **Correction:** Separate conclusion from report-only finalization and forbid
  additional tooling after the conclusion is known.
- **Prevention:** Give audit workers a fixed report template and bounded
  conclusion deadline at dispatch time.
- **Owner:** Codex.
- **Next diagnostic step:** None.

## Verification and related work

Both ignored audit report files now exist and contain safe conclusions.

## Recurrence history

- 2026-07-28T14:21:00Z: First observed during the role-probe architecture
  audits and closed after report-only redispatch.
- 2026-07-28T14:58:01Z: Recurred when the acceptance-instrumentation
  architecture worker remained active through repeated bounded waits, a
  finalize message, interruption, and report-only redispatch without creating
  its report. The worker was stopped; the controller proceeds from two
  completed audits and its independently confirmed live call-path trace. No
  repository or provider state changed.
- 2026-07-28T18:38:44Z: Recurred when three read-only final-plan reviewers
  remained active after repeated bounded waits and concise finish messages
  without producing their requested reports. They were stopped after the
  earlier three planning maps, local structural checks, documentation check,
  and migration-diff check had already passed. No repository or provider state
  changed.
