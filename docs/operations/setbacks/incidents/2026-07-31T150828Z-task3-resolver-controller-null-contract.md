# SB-20260731-150828-task3-resolver-controller-null-contract: Resolver close-evidence type outpaced controller integration

- **Status:** closed
- **First observed:** 2026-07-31T15:08:28.7173977Z
- **Last observed:** 2026-07-31T15:30:50.5669463Z
- **Phase/task:** Phase B Task 3 final resolver/controller review repair
- **Environment:** Shared worktree; canonical TypeScript integration gate
- **Version/commit:** 73191b7 plus unstaged TDD repairs and setback records

## Symptom

The repaired resolver suite passes 71 tests, but TypeScript fails at the
controller observer-port boundary because the resolver now correctly permits
a null provider uniqueness close while the controller's local port type still
accepts only an optional date.

## Impact

The resolver lane cannot complete canonical verification until the separately
owned controller consumes the nullable evidence contract.

## Reproduction conditions

Compile the shared worktree after the resolver removes locally fabricated
close evidence but before the controller lane updates its port/result handling.

## Safe evidence

Only the type-mismatch category, ownership boundary, and aggregate resolver
test count were reported. No source, URI, credential, protected identifier,
provider value, runtime stream, argument, or environment value was emitted.

## Attempts and outcomes

- Resolver tests pass 71/71.
- Resolver references were updated.
- The resolver writer correctly did not cross-edit controller-owned files.

## Cause classification

- **Confirmed cause:** Expected cross-owned API integration lag.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Resolver runtime behavior is not red.
- **Known exclusions:** No provider, Git, or external state changed.

## Correction and prevention

- **Correction:** The controller lane must accept and safely handle
  `Date | null` without converting local time into provider evidence; then both
  lanes rerun canonical TypeScript and docs gates.
- **Prevention:** Explicitly coordinate nullable evidence contracts before
  parallel lane final verification.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Complete controller integration, then resume
  resolver final verification.

## Verification and related work

The controller now accepts nullable provider close evidence and uses a separate
local no-signal deadline without fabricating provider attribution. Resolver,
controller, TypeScript, docs, focused integration, and full repository checks
pass.

## Recurrence history

- 2026-07-31T15:08:28.7173977Z: First observed after resolver GREEN and
  contained at the controller ownership boundary.
- 2026-07-31T15:30:50.5669463Z: Closed after the shared contract and all
  canonical integration gates passed.
