# SB-20260730-233315-task3-final-repair-multifile-context: Task 3 final-repair multi-file patch missed resolver context

- **Status:** closed
- **First observed:** 2026-07-30T23:33:15.117913Z
- **Last observed:** 2026-07-31T04:20:06.3651997Z
- **Phase/task:** Phase B live-acceptance closure Task 3 final repair
- **Environment:** Local Task 3 final-repair working tree
- **Version/commit:** Working tree after `b1935577c211`

## Symptom

A combined implementation patch failed verification because one resolver comparison hunk did not match the exact existing line layout.

## Impact

The combined patch applied no hunks; a later separate patch added only the new supervisor file before the pause arrived. Other production paths remained unchanged.

## Reproduction conditions

Apply a combined add/update patch across the supervisor, printer, resolver, and
observer-state files using one stale resolver context.

## Safe evidence

Patch verification rejected the entire combined change before applying any
hunk.

## Attempts and outcomes

- The combined patch applied nothing.
- A later narrow patch added only the new supervisor file.
- Remaining fixes are split into exact single-file patches.

## Cause classification

- **Confirmed cause:** One resolver hunk assumed a different existing line
  layout.
- **Hypotheses:** None.
- **Rejected hypotheses:** No concurrent overwrite or missing target file
  caused the mismatch.
- **Known exclusions:** No protected value, provider, network, Git history,
  external state, or backup-key lifecycle was involved.

## Correction and prevention

- **Correction:** Retain the separately added supervisor and apply each
  remaining production change through a narrow exact-context patch.
- **Prevention:** Avoid multi-file implementation patches when one target has
  not been matched against its exact current context.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The failed patch changed nothing; the subsequent supervisor-only addition is
intentional and covered by the already collected RED suite.

## Recurrence history

- 2026-07-30T23:33:15.117913Z: First observed.
- 2026-07-31T00:34:07.0666974Z: Recurred when a combined test-only correction
  assumed the fake supervisor template literal was multiline. The exact file
  stores that fixture on one long line, so verification rejected the patch
  before any change. The retry is split by file and exact current text.
- 2026-07-31T01:50:37.2528640Z: Recurred when a ledger-closing patch used an
  inferred helper timestamp instead of the incident file's exact generated
  timestamp. Verification rejected the entire patch before any hunk applied.
  The exact file and index rows were read before the retry.
- 2026-07-31T01:51:56.2820330Z: The resolver writer's first combined
  projection/deadline production patch did not match exact current context.
  Verification rejected it before applying any hunk, while the two prior
  green-group edits remained intact. The retry is split into smaller
  single-file exact hunks.
- 2026-07-31T02:06:27.6118790Z: The isolated controller writer inferred
  compact formatting for a concrete dependency block. The atomic production
  patch did not match and applied nothing, leaving only the intended RED test.
  The retry is symbol-anchored and split into smaller exact hunks.
- 2026-07-31T02:20:45.7242983Z: A split no-signal controller change applied
  its first production hunk, but the paired wait-result type hunk missed the
  file's exact formatting. No test ran against the intentionally incomplete
  intermediate state; the missing type change is completed through one
  symbol-anchored hunk before any other action.
- 2026-07-31T02:21:26.4685969Z: The first type-completion retry followed a
  generated printer's multiline view, while the source stores the nested
  `Awaited`/`ReturnType` opening on one line. No additional change applied and
  the intermediate state was not tested. The next hunk uses that verified
  literal token layout only.
- 2026-07-31T02:39:11.5411372Z: The true-close controller interface hunk
  applied, but the paired observer-snapshot hunk missed exact formatting. No
  test ran against the partial but type-valid state. Completion is restricted
  to the missing symbol-anchored snapshot hunks before verification.
- 2026-07-31T02:45:45.5959626Z: The shared controller deadline type and runner
  signature applied, but a combined multi-method dependency-interface hunk
  missed exact formatting and applied nothing. No test or compiler ran against
  the partial type state. The remaining method signatures are patched
  individually before verification.
- 2026-07-31T02:49:17.2929992Z: The shared deadline wrapper and bounded
  pre-signal path applied, but a combined rollback-and-close hunk missed exact
  formatting and applied nothing. No run occurred while rollback call sites
  were incomplete. Rollback signature, dispatch, and closure are completed as
  separate symbol-anchored hunks.
- 2026-07-31T02:53:06.7150590Z: The concrete invoke, driver, and success-check
  signatures accepted the deadline boundary, but the first remote-tip adapter
  hunk assumed a different argument layout and applied nothing. The
  compiler-incomplete source is completed one adapter at a time using only
  signature and closing invoke-line anchors.
- 2026-07-31T02:55:28.4806591Z: Observer, attribution, restore-admission, and
  approval adapters accepted the boundary, but the perform-action adapter hunk
  missed its command formatting and applied nothing. No compiler/test ran
  after the miss; only perform-action is retried using its signature line and
  final argument anchor.
- 2026-07-31T02:56:39.2817685Z: The perform-action-only retry still assumed
  its serialized-action array was on one source line, while the source splits
  it across two. No change applied. The correction is reduced to two literal
  micro-hunks: the method signature and the closing call line only.
- 2026-07-31T02:58:50.3936706Z: Verify-closure plus observer
  dispatch/resolution calls accepted the deadline boundary, but the candidate
  dispatch hunk followed a generated multiline shape while the source uses a
  single-line call. No compiler ran after the miss. Only the candidate call's
  closing line is changed before the next progression check.
- 2026-07-31T03:02:48.1733278Z: Attribution, approval/action, rollback, and
  signal/no-signal read boundaries applied, but the maintenance read hunk
  assumed a different settlement-calculation layout and applied nothing. The
  retry changes only its existing `readObserverState` line using the local
  settlement monotonic symbol before recompilation.
- 2026-07-31T03:05:13.2544257Z: The shared wrapper return and rollback-local
  narrowing applied, but the candidate-local narrowing hunk missed surrounding
  formatting and applied nothing. The correction is limited to a stable local
  assignment and symbol-only verification/action input replacements before
  recompilation.
- 2026-07-31T03:52:22.4327304Z: A combined setback-ledger patch assumed an
  outdated next-diagnostic sentence in an older incident and applied nothing.
  The retry is split into exact file-local micro-patches before any diagnostic
  continuation.
- 2026-07-31T03:54:50.2659550Z: Closed after each intended ledger update
  applied as an exact file-local micro-patch and the new incident was indexed.
- 2026-07-31T04:05:56.7016738Z: A combined four-fixture test patch missed the
  reconciled-attribution assertion's current formatting and applied nothing.
  Each fixture correction is retried as an independent exact micro-patch.
- 2026-07-31T04:18:18.8099369Z: A rollback-fixture correction used unsupported
  line-number hunk syntax and applied nothing. The replacement uses a uniquely
  named local variable and exact symbol context instead of positional patching.
- 2026-07-31T04:20:06.3651997Z: Closed after symbol-anchored micro-patches
  applied and the full controller test/typecheck verification passed.
