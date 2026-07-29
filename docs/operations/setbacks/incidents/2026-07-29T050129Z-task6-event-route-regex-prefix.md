# SB-20260729-050129-task6-event-route-regex-prefix: Event route regex matched an approved category path

- **Status:** closed
- **First observed:** 2026-07-29T05:01:11Z
- **Last observed:** 2026-07-29T05:01:29.0263179Z
- **Phase/task:** Phase B acceptance instrumentation Task 6 RED
- **Environment:** Local Phase B linked worktree
- **Version/commit:** `1c7f89b`

## Symptom

A new direct-source policy assertion rejected the repository before any Task 6
production edit because its event-route expression treated every path beginning
with `/api/calendar/events` as an event-write endpoint.

## Impact

One intended-green security assertion failed for the wrong reason. The other
Task 6 RED failures remained valid. No runtime, provider, database, browser, or
network state changed.

## Reproduction conditions and safe evidence

The expression did not require an endpoint boundary after `events`, so it also
matched the existing reviewed Vision-only category route below that prefix.
The established release scanner already owns precise Google event-write route
classification.

## Attempts and outcomes

- The combined RED suite exposed the overbroad assertion.
- A bounded tracked-source search confirmed no direct exact event-write route.
- The redundant prefix assertion was removed; the new test retains the public
  operator/acceptance-route absence check and the established release-scanner
  cases continue to cover Google event writes.

## Cause classification

- **Confirmed cause:** The test expression omitted the endpoint boundary and
  duplicated a more precise existing policy.
- **Hypotheses:** None.
- **Rejected hypotheses:** Task 6 did not introduce a Google event-write route.
- **Known exclusions:** No source implementation or approved evidence contract
  changed.

## Correction and prevention

- **Correction:** Remove the redundant prefix expression and rely on the
  existing exact event-write scanner coverage.
- **Prevention:** When adding route-policy checks, distinguish an endpoint from
  a shared route prefix and avoid duplicating a stricter existing scanner.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The focused security suite will be rerun after the test correction.
