# SB-20260731-180351-provider-validator-type-narrowing: Provider validator lost TypeScript narrowing across repeated searches

- **Status:** closed
- **First observed:** 2026-07-31T18:03:51.7991178Z
- **Last observed:** 2026-07-31T18:03:51.7991178Z
- **Phase/task:** Phase B Task 3 fourth-wave lifecycle repair
- **Environment:** Local TypeScript check
- **Version/commit:** 45b6393 plus in-progress lifecycle edits

## Symptom

The owned TypeScript check reported two possibly undefined records in the
provider-state validator. The code checked `Array.find` results in one
expression and then repeated the searches before reading their values, so the
compiler could not retain the earlier narrowing.

## Impact

Runtime unit tests are green, but the implementation cannot pass the compile
gate until the records are narrowed safely. No provider, environment, network,
secret, staging, or commit was touched.

## Cause classification

- **Confirmed cause:** Repeated search expressions discarded TypeScript's
  control-flow proof that the matching records existed.
- **Hypotheses:** None remaining.
- **Known exclusions:** This is not a runtime provider-validation failure.

## Correction and prevention

- **Correction:** Store the matching records, validate them once, then access
  their values through the narrowed variables and rerun the exact typecheck.
- **Prevention:** Preserve narrowed lookup results instead of repeating
  collection searches across validation branches.
- **Owner:** Codex.
- **Next diagnostic step:** None; the correction is exact.

## Recurrence history

- 2026-07-31T18:03:51.7991178Z: Observed, contained, and closed before any
  external action.
