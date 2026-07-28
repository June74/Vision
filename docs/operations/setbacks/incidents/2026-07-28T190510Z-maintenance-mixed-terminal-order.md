# SB-20260728-190510-maintenance-mixed-terminal-order: Maintenance mixed-terminal rejection depended on order

- **Status:** closed
- **First observed:** 2026-07-28T19:05:10.713358Z
- **Last observed:** 2026-07-28T19:05:48.1403518Z
- **Phase/task:** Phase B acceptance instrumentation Task 1 self-review
- **Environment:** Local Vitest 4.1 unit project
- **Version/commit:** `f3873fe` plus uncommitted Task 1 changes

## Symptom

The safe-tail classifier rejected a mixed terminal record only when the maintenance record appeared before the other terminal record.

## Impact

A synthetic role-probe record before otherwise valid maintenance evidence could pass local classification. The defect was found before staging, commit, workflow execution, or live evidence capture; no private value was involved.

## Reproduction conditions

Classify a normal maintenance tail containing an exact role-probe terminal
before an otherwise valid maintenance terminal.

## Safe evidence

The reversed-order regression test returned valid maintenance evidence instead
of `null`; the forward order was already rejected.

## Attempts and outcomes

- The new reversed-order test failed once for the expected reason.
- One condition now marks any non-maintenance terminal seen during the
  maintenance scan, regardless of order.
- The focused classifier, executable, workflow, and routing boundary passed
  45 tests after the correction.

## Cause classification

- **Confirmed cause:** The mixed-terminal flag was set only when maintenance
  had already been seen, making rejection depend on record order.
- **Hypotheses:** None.
- **Rejected hypotheses:** Evidence reconstruction and cron matching were not
  responsible.
- **Known exclusions:** No live log, workflow run, provider value, or private
  state was involved.

## Correction and prevention

- **Correction:** Retain mixed-terminal state independently of maintenance
  record order.
- **Prevention:** Test both permutations for duplicate and mixed terminal
  rejection.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

RED: the reversed-order case returned a maintenance object. GREEN: the four
focused safe-tail and workflow files passed 45/45 tests.

## Recurrence history

- 2026-07-28T19:05:10.713358Z: First observed.
