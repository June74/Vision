# SB-20260802-064954-final-plan-audit-read-tools-prohibited: Final plan audit instruction prohibited required read tools

- **Status:** closed
- **First observed:** 2026-08-02T06:49:54.1629691Z
- **Last observed:** 2026-08-02T06:55:29.3691457Z
- **Phase/task:** Phase B reconnect-recovery implementation-plan final audit
- **Environment:** Local Phase B worktree and one read-only review subagent
- **Version/commit:** `bf49b9b`

## Symptom

The final audit instruction asked the reviewer to inspect the corrected plan but
also prohibited every tool. The reviewer therefore could not open the shared
file and could only report that its earlier snapshot still contained the four
pre-correction findings.

## Impact

The planning commit was delayed by one review round. No source, test, database,
provider, credential, calendar, deployment, object, key, or backup state
changed, and no private value was inspected or retained.

## Reproduction conditions

Assign a file-verification task to a subagent while saying both "inspect the
current plan" and "do not run tools." The second instruction prevents the
read-only access required by the first.

## Safe evidence

The reviewer returned a process-only statement that it could not verify the
corrected snapshot. No repository contents or private identifiers were quoted.

## Attempts and outcomes

- The first final-audit request failed closed without reading the updated file.
- A corrected follow-up explicitly authorized read-only filesystem and search
  tools while continuing to prohibit edits and secret inspection.

## Cause classification

- **Confirmed cause:** The orchestration instruction used "no tools" as a
  shorthand for no mutation, accidentally excluding necessary read-only tools.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The result did not establish a defect in the plan or
  application.
- **Known exclusions:** No external mutation, secret access, source edit,
  deployment, database write, or key change occurred.

## Correction and prevention

- **Correction:** Reissue the audit with read-only tools explicitly allowed and
  edits explicitly forbidden.
- **Prevention:** Future independent file audits must distinguish read-only
  inspection from mutation instead of prohibiting all tools.
- **Owner:** Codex.
- **Next diagnostic step:** None; keep read-only access explicit in future
  review assignments.

## Verification and related work

The corrected assignment used read-only tools, inspected the current shared
file, drove two further plan corrections, and ended with PASS plus zero Critical
and zero Important findings. This incident and its index row stay outside the
specification and implementation-plan commit.

## Recurrence history

- None.
