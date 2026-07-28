# SB-20260728-223654-frozen-privilege-array-type-widening: Frozen privilege arrays widened during typecheck

- **Status:** closed
- **First observed:** 2026-07-28T22:36:54.213810Z
- **Last observed:** 2026-07-28T22:46:26.2499697Z
- **Phase/task:** Phase B acceptance instrumentation Task 3 live privilege manifest
- **Environment:** Local Phase B worktree
- **Version/commit:** Task 3 patch based on `db4f42c`

## Symptom

Typecheck rejected the deeply frozen manifest because nested privilege literals widened to generic string arrays.

## Impact

The compile gate stopped before completion; focused runtime tests remained green and no provider state changed.

## Reproduction conditions

Run both TypeScript projects after assigning nested `Object.freeze()` results
directly to the typed privilege-manifest export.

## Safe evidence

The compiler reported only the exported manifest type and the generic-string
array incompatibility. No attested values were copied into this incident.

## Attempts and outcomes

- Adding a root `satisfies` boundary narrowed the schema privilege array but
  did not propagate through the nested frozen table objects.
- An explicit assertion at the already validated manifest boundary compiled
  but an independent review correctly rejected its compile-time bypass.
- An array-level typed freeze helper still left each nested object inferred
  before contextual typing.
- A non-generic typed freezer for each explicit table object, combined with an
  outer `satisfies` check, preserved both runtime freezing and compile-time
  validation.

## Cause classification

- **Confirmed cause:** TypeScript inferred nested frozen privilege arrays as
  generic strings before applying the outer export annotation.
- **Hypotheses:** None.
- **Rejected hypotheses:** The attested runtime data was not malformed; the
  exact structural contract test passed before the compile gate.
- **Known exclusions:** No provider state, secret, or private identifier was
  changed or recorded.

## Correction and prevention

- **Correction:** Contextually type and freeze each explicit table entry, then
  check the complete immutable literal with `satisfies`.
- **Prevention:** Run both focused runtime validation and TypeScript compilation
  after introducing nested frozen literals.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

`pnpm.cmd typecheck` passed without a manifest type assertion. The exact
manifest contract remained covered by the focused unit test.

## Recurrence history

- 2026-07-28T22:36:54.213810Z: First observed.
- 2026-07-28T22:38:36.2933763Z: The root `satisfies` attempt still left nested
  table privilege arrays widened. The explicit validated-boundary assertion
  compiled successfully.
- 2026-07-28T22:46:26.2499697Z: Independent review rejected the compiling
  assertion because it bypassed future literal validation. The array-level
  helper reproduced the nested widening; per-table typed freezing plus outer
  `satisfies` passed typecheck with no attested-value change.
