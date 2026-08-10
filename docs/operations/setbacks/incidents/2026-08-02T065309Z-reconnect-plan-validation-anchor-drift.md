# SB-20260802-065309-reconnect-plan-validation-anchor-drift: Plan structure check used a stale JSDoc phrase

- **Status:** closed
- **First observed:** 2026-08-02T06:53:09.7003397Z
- **Last observed:** 2026-08-02T06:55:29.3691457Z
- **Phase/task:** Phase B reconnect-recovery implementation-plan validation
- **Environment:** Local Phase B worktree documentation checks
- **Version/commit:** `bf49b9b`

## Symptom

The combined plan-validation command exited nonzero after the documentation
validator passed because one ad hoc required-text anchor expected an older
JSDoc sentence that was no longer present.

## Impact

The planning checkpoint was delayed while the failure was classified. No
source, test, database, provider, credential, calendar, deployment, object,
key, or backup state changed.

## Reproduction conditions

Run the local anchor check with the phrase `Property that recovers
authorization state` against the corrected plan, whose adapter JSDoc instead
says it delegates the narrow callback port to the owner-scoped repository.

## Safe evidence

The documentation validator exited successfully. The structure summary was
`required=7 missing=1 forbidden=0 fences=98 tasks=5 steps=36`, and the only
missing anchor was the obsolete phrase. No private value was read or printed.

## Attempts and outcomes

- The combined validator stopped before the final diff check because the stale
  anchor made its structural condition false.
- A narrow read confirmed the adapter still has its property-level JSDoc and
  only the ad hoc phrase had drifted.

## Cause classification

- **Confirmed cause:** The ad hoc structural checker encoded review wording
  rather than the plan's current semantic anchor.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The failure was not a documentation-validator error
  and did not establish a missing adapter JSDoc.
- **Known exclusions:** No implementation, external mutation, secret access,
  deployment, database write, or key change occurred.

## Correction and prevention

- **Correction:** Replace the obsolete check phrase with the exact current
  property-level JSDoc anchor and rerun the full documentation, structure, and
  diff gates.
- **Prevention:** Keep ad hoc anchors tied to stable semantic identifiers and
  print the missing anchor before classifying a validation failure.
- **Owner:** Codex.
- **Next diagnostic step:** None; use the corrected semantic anchors during
  execution-plan maintenance.

## Verification and related work

The corrected run passed documentation coverage, reported nine required
anchors with zero missing, zero forbidden placeholders, 98 balanced fences,
five tasks, and 36 steps, and passed the exact planning-path diff check. This
incident and its index row remain outside the specification and
implementation-plan commit.

## Recurrence history

- None.
