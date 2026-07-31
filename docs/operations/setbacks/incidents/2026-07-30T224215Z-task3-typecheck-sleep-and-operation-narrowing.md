# SB-20260730-224215-task3-typecheck-sleep-and-operation-narrowing: Task 3 repair failed TypeScript annotation and narrowing gate

- **Status:** closed
- **First observed:** 2026-07-30T22:42:15.521034Z
- **Last observed:** 2026-07-31T03:09:57.0985798Z
- **Phase/task:** Phase B live-acceptance closure Task 3 required verification
- **Environment:** Local required TypeScript gate
- **Version/commit:** Task 3 repair working tree after `38bed3e`

## Symptom

Typecheck rejected default sleep callback inference, implicit-any parameters, and one candidate operation widened beyond its closed union.

## Impact

The required type gate failed before full acceptance; focused runtime suites remained green and no external state changed.

## Reproduction conditions

Run the repository TypeScript gate after the focused controller, resolver,
workflow, lifecycle, restore, R2, and provider suites are green.

## Safe evidence

The compiler returned only local type categories in three Task 3 paths; no
runtime test or external operation failed.

## Attempts and outcomes

- Focused behavioral suites passed before the gate.
- Typecheck isolated missing callback annotations and one widened operation
  union.
- The decisive resolver repair later reached one new compiler error in the
  resolver source while all 55 resolver tests remained green.
- The isolated restore facade/scheduler repair passed its focused runtime test
  but produced two source and two test compiler diagnostics.
- The resolver diagnostic was isolated and corrected; its 55 focused tests
  and full typecheck now pass. The incident remains open only for the restore
  lane.
- Restore diagnosis found a public string/internals numeric key-version
  boundary. It now validates public value `1`, converts only at the internal
  importer boundary, and stringifies scheduler configuration only at the
  public façade.
- The controller deadline-boundary conversion later reached 21 compiler
  diagnostics across four type categories at its rollback checkpoint.
- Progressive normalization eliminated all expected argument-count errors, but
  the final restore-admission boundary exposed two TS2322 assignment
  diagnostics.

## Cause classification

- **Confirmed cause:** Newly composed default callbacks lacked explicit
  signatures, and one lifecycle reconstruction did not preserve the closed
  operation union. In the decisive resolver repair, TypeScript also did not
  treat a helper-based `never` exit inside try/catch/finally as a total return.
  In the restore repair, the frozen public key version is a string while the
  key importer and parsed scheduler configuration use a number. The current
  controller occurrence is a partially propagated async dependency/runner
  signature: argument-count failures were expected RED, while assignment,
  argument, and total-return categories required source normalization. The
  final two assignments lost closure narrowing on already validated restore
  run references.
- **Hypotheses:** None.
- **Rejected hypotheses:** The failure is not a runtime, provider, or workflow
  behavior defect.
- **Known exclusions:** No secret, provider, network, database, object storage,
  external state, or key lifecycle was involved.

## Correction and prevention

- **Correction:** Add exact callback parameter/return annotations, preserve
  the already validated closed candidate-operation union, and use an explicit
  constant safe throw where the compiler cannot prove the helper exit is
  total. Validate the restore façade's public string value and convert only at
  the narrow numeric internal boundary. Capture validated restore run
  references in stable locals before closure-based assignments.
- **Prevention:** Run typecheck immediately after each exported dependency
  shape changes, before expanding the full behavioral suite.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; proceed to behavioral deadline tests.

## Verification and related work

Closure is contingent on the immediate typecheck rerun; any remaining compiler
failure must be reported separately.

## Recurrence history

- 2026-07-30T22:42:15.521034Z: First observed.
- 2026-07-30T22:44:32.7663927Z: After production annotations were clean, the
  same gate reached three controller test overrides whose literal state fields
  widened to strings. The correction is limited to preserving those fixture
  literals with const assertions before rerunning typecheck.
- 2026-07-31T00:22:09.4004429Z: The final bounded repair added a private
  restore re-admission helper whose two default filesystem dependency lambdas
  omitted explicit string parameter annotations. The focused runtime suite was
  green; the correction is limited to those two annotations before rerunning
  typecheck.
- 2026-07-31T00:22:57.9193247Z: After those annotations, typecheck reached
  three test fixtures that still supplied the removed maintenance close field.
  The correction is limited to deleting those stale test-only properties before
  the next gate run.
- 2026-07-31T00:37:21.4659713Z: The cross-platform supervisor teardown test
  added two deferred resolver variables whose inference returned `undefined`
  instead of `void`. The focused behavior was green; the correction is limited
  to explicit `() => void` test annotations before restarting the aggregate
  gate.
- 2026-07-31T01:59:20.0344324Z: The decisive resolver repair passed all 55
  focused tests but the full TypeScript gate found exactly one resolver-source
  error and none in the test file. No diagnostic text, provider value, runtime
  stream, or external state entered output; bounded diagnosis is pending.
- 2026-07-31T01:59:48.5531721Z: The isolated restore repair's focused runtime
  test passed, while separate source and test compilation checks returned two
  diagnostics each after the minimal facade/scheduler change. No diagnostic
  text, URI, protected value, or external state entered output; bounded
  diagnosis is pending.
- 2026-07-31T02:01:56.6236285Z: Resolver diagnosis isolated TS2366 to
  `callBeforeDeadline`; an explicit constant safe throw completed the return
  proof. All 55 resolver tests and the full TypeScript gate passed. Restore
  compiler correction remains pending before incident closure.
- 2026-07-31T02:02:33.7188545Z: Restore diagnosis isolated the public string
  versus internal numeric key-version boundary. Focused runtime tests plus
  source and test compilation checks passed with zero diagnostics, closing the
  incident.
- 2026-07-31T02:51:15.4919051Z: Reopened at the controller rollback compiler
  checkpoint with 21 diagnostics across TS2322, TS2345, TS2366, and TS2554.
  The TS2554 argument-count errors are the intended deadline-propagation RED;
  the other categories show partially converted runner/rollback signatures.
  No test or further edit occurred.
- 2026-07-31T03:08:18.8257757Z: Deadline propagation reduced the compiler to
  one expected TS2554 restore-admission call, and patching it removed that
  category but exposed two TS2322 assignments. The writer stopped before
  inspection; no test or external action occurred.
- 2026-07-31T03:09:57.0985798Z: Both TS2322 assignments were closure-narrowing
  losses on validated restore run references. Stable locals fixed them; direct
  TypeScript compilation passed with zero diagnostics, closing the incident.
