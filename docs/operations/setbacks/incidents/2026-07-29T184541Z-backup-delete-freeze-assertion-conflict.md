# SB-20260729-184541-backup-delete-freeze-assertion-conflict: Backup delete freeze assertion conflicts with recovery design

- **Status:** contained
- **First observed:** 2026-07-29T18:45:41Z
- **Last observed:** 2026-07-29T18:45:41Z
- **Phase/task:** Phase B acceptance instrumentation Task 7
- **Environment:** Local Phase B worktree
- **Version/commit:** `d4de4de`

## Symptom

The Task 7 plan asks the freeze reviewer to confirm that no code can delete
objects under the fixed backup prefix. The existing approved Phase B recovery
implementation intentionally exposes bounded deletion for failed-new-object
verification rollback and expired-object retention.

## Impact

The literal Task 7 assertion cannot be truthfully marked green without removing
approved recovery behavior. No deletion was executed, no provider was accessed,
and the acceptance instrumentation range added no deletion call.

## Reproduction conditions

Scan production source for the fixed backup prefix and object-store deletion,
then trace the matching call sites into daily backup verification rollback and
the 30-day retention job.

## Safe evidence

- The acceptance range changes one daily-backup file but adds and removes zero
  deletion-call lines.
- The retention module is unchanged across the acceptance range.
- The approved recovery plan explicitly requires validated expired-object
  deletion.
- No provider, object, object key, credential, or private identifier was read
  or emitted.

## Attempts and outcomes

- A coarse static heuristic found one literal-prefix file with a deletion call.
- Root-cause tracing found a second deletion path through the imported prefix
  constant.
- The historical recovery plan confirmed both are intentional bounded recovery
  behavior, not acceptance instrumentation expansion.

## Cause classification

- **Confirmed cause:** The Task 7 wording is broader than the approved recovery
  design and existing production contract.
- **Hypothesis:** The intended freeze invariant is that acceptance work must not
  add deletion capability or execute provider deletion, and that the backup
  namespace must not be removed or cleaned up during acceptance.
- **Rejected hypothesis:** Acceptance instrumentation introduced a new backup
  deletion path. The exact range diff contains no added deletion-call line.
- **Known exclusions:** No R2 list, read, write, or delete operation occurred.

## Correction and prevention

- **Correction:** Preserve the approved recovery implementation and report the
  literal assertion as a Task 7 concern. Verify instead that the acceptance
  range adds no deletion call and the local freeze performs no provider action.
- **Prevention:** Future acceptance plans should distinguish forbidden
  acceptance cleanup from approved verification rollback and retention.
- **Owner:** Project owner and Task 7 controller.
- **Next diagnostic step:** Confirm the intended wording before live acceptance
  or Task 8 cleanup; do not remove bounded recovery retention as a local-freeze
  workaround.

## Verification and related work

The exact acceptance-range diff reports zero added or removed deletion-call
lines in the daily-backup module and no change to the retention module. The
full local test, browser, build, documentation, and security gates remain
green.
