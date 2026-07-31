# SB-20260731-135203-task3-resolver-typecheck-regression: Resolver repair produced eight TypeScript diagnostic lines

- **Status:** closed
- **First observed:** 2026-07-31T13:52:03.3498930Z
- **Last observed:** 2026-07-31T14:05:00.9419278Z
- **Phase/task:** Phase B Task 3 resolver final-review repair
- **Environment:** Main Phase B worktree; repository-local TypeScript compiler
- **Version/commit:** c5de12d plus owned resolver repair

## Symptom

The direct TypeScript compiler exited nonzero and returned eight diagnostic
lines after all focused resolver behavior tests passed.

## Impact

The resolver repair is not integration-ready despite green runtime tests.
Changes remain limited to the resolver source, its unit test, and simple and
technical resolver references.

## Reproduction conditions

Compile the current resolver repair after adding optional outer-boundary
support, conservative uniqueness close, and new typed test fixtures.

## Safe evidence

Compatibility cases, all 10 new cases, and the complete 66-test resolver file
passed. The compiler returned eight diagnostic lines; no diagnostic payload,
source stream, URI, credential, protected identifier, provider value, argument
list, or environment value was emitted.

## Attempts and outcomes

- Exact compatibility selection passed.
- All 10 new contract cases passed.
- The complete resolver file passed 66 of 66 tests.
- Direct TypeScript compilation failed with eight diagnostic lines.
- No stage, commit, provider action, or external mutation occurred.

## Cause classification

- **Confirmed cause:** None yet beyond a static type regression in the owned
  resolver changes.
- **Hypotheses:** Optional boundary/test dependency signatures or
  uniqueness-close result typing no longer align at all call sites.
- **Rejected hypotheses:** Runtime behavior is not red.
- **Known exclusions:** Changes remain inside the four owned resolver paths.

## Correction and prevention

- **Correction:** Classify compiler diagnostic codes and owned-file locations
  without emitting source payload, then apply the minimal type-safe correction.
- **Prevention:** Run direct source and test compiler checks immediately after
  API-shape changes, before documentation work.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The optional boundary and test fixture types were corrected without changing
the green behavior contract. The repository-local compiler finished with zero
diagnostics.

## Recurrence history

- 2026-07-31T13:52:03.3498930Z: First observed and contained after behavior
  verification.
- 2026-07-31T14:05:00.9419278Z: Closed after TypeScript passed with zero
  diagnostics alongside 66 green resolver tests.
