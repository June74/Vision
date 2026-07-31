# SB-20260731-144137-task3-report-force-add-recurrence: Task 3 report staging omitted the required force flag

- **Status:** closed
- **First observed:** 2026-07-31T14:41:37.2218561Z
- **Last observed:** 2026-07-31T14:42:23.2760667Z
- **Phase/task:** Phase B Task 3 final report staging
- **Environment:** Main Phase B worktree; intentionally ignored process report
- **Version/commit:** b4f6dce

## Symptom

The first exact-path staging command for the Task 3 report omitted the force
flag required for the intentionally ignored `.superpowers` directory.

## Impact

The verified report remains unstaged. The implementation commit is unaffected.

## Reproduction conditions

Stage the ignored Task 3 report with ordinary `git add` rather than the
previously established exact-path force-add procedure.

## Safe evidence

Git returned only the ignored-path category and general force-add guidance. No
report content, URI, credential, protected identifier, provider value,
environment value, staged content, or external state was exposed or changed.

## Attempts and outcomes

- The report diff check passed before staging.
- Git made no index change for the report.

## Cause classification

- **Confirmed cause:** The exact report is ignored and the command omitted
  `-f` despite the earlier Task 3 precedent.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** No permission or content-validation failure
  occurred.
- **Known exclusions:** No implementation or setback path was staged.

## Correction and prevention

- **Correction:** Force-add only the exact Task 3 report, then require a
  one-path cached allowlist.
- **Prevention:** Treat ignored process reports as an explicit force-add step
  in every Task report handoff.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Retry exact-path report staging with `-f`.

## Verification and related work

The exact report was force-staged as the sole cached path. Cached scope and
diff checks passed, with zero setback paths staged.

## Recurrence history

- 2026-07-31T14:41:37.2218561Z: First observed and contained with zero index
  mutation.
- 2026-07-31T14:42:23.2760667Z: Closed after the exact one-path force-add and
  cached allowlist checks passed.
