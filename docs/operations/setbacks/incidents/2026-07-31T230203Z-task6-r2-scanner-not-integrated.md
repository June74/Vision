# SB-20260731-230203-task6-r2-scanner-not-integrated: R2 capability scanner missed production and indirect enforcement paths

- **Status:** closed
- **First observed:** 2026-07-31T23:02:03.6993294Z
- **Last observed:** 2026-08-01T00:27:49.9551896Z
- **Phase/task:** Phase B Task 6 R2 independent review
- **Environment:** Local sanitized source/test review
- **Version/commit:** a22c345 plus uncommitted Task 6 lanes

## Symptom

The scanner is exported and directly tested but not invoked by `scanRelease`,
so the real security command does not enforce it. Review also found that caller
guards are accepted by token presence rather than exact semantics, bound delete
callbacks can escape through direct return/pass/reassignment/re-export shapes,
and multiline or indirect deletion workflow commands can evade line-local
inspection.

## Impact

`pnpm security:scan` could pass with an unauthorized R2 deletion path, and
approved callers could move deletion outside the same-invocation or validated
30-day guard without becoming `unexpected`. Task 6 is not acceptable. No live,
provider, network, R2, staging, or external state changed.

## Cause classification

- **Confirmed cause:** Focused tests exercised the scanner in isolation rather
  than through the production release entrypoint.
- **Confirmed cause:** Guard and workflow analysis used permissive syntactic
  presence rather than exact semantic/structural validation.
- **Confirmed cause:** Capability propagation omitted several direct bound and
  exported factory forms.
- **Confirmed cause:** Approved-caller analysis did not reject reassignment of
  the creation and retention-derived guard variables before deletion.
- **Confirmed cause:** Workflow block-scalar recognition covered only a subset
  of valid YAML chomping and quoted-key forms.
- **Confirmed cause:** The approved-caller proof compares identifier text
  instead of resolved binding identity, so shadowed bindings and alias-based
  mutation can inherit approval incorrectly.
- **Confirmed cause:** Retention-constant validation proves only a numeric
  initializer, not a `const` binding that remains immutable.
- **Confirmed cause:** YAML scalar-body collection uses the `run` key indent
  instead of the first content indent, so sibling step fields can bleed into
  the scanned command.

## Correction and prevention

- **Correction:** Add RED cases for production entrypoint enforcement, negated
  and permissive guards, distant validation calls, direct/reassigned/re-exported
  bound callbacks, multiline YAML, and indirect cleanup/purge/destroy commands;
  then close those paths with AST plus block-aware config inspection.
- **Prevention:** Security scanners require adversarial bypass tests and a real
  command-integration test, not only direct-function unit tests.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Recurrence history

- 2026-07-31T23:02:03.6993294Z: Initial production-entrypoint gap found.
- 2026-07-31T23:02:40.6283546Z: Final review added exact guard, callback, and
  multiline/indirect workflow bypass findings.
- 2026-07-31T23:18:47.1299665Z: Independent re-review reproduced two remaining
  bypass classes: mutation of guard-derived variables and valid multiline YAML
  scalar variants. Task 6 remained open and the four-path lane was returned for
  focused RED/GREEN repair without live or provider action.
- 2026-07-31T23:33:55.4757839Z: A second re-review reproduced shadowed-binding,
  alias-mutation, mutable-retention-constant, and YAML sibling-field cases that
  name-based incremental checks still misclassified. Further narrow patching
  stopped; the next repair must use binding-aware fail-closed analysis and an
  exact YAML scalar-body boundary before re-review.
- 2026-07-31T23:53:25.8929194Z: The binding-aware redesign's first GREEN
  attempt fixed all eight new adversarial cases and passed 45 of 46 focused
  tests, but conservatively classified the real retention purge caller as
  unexpected. TypeScript also exposed one local non-null narrowing issue, which
  was corrected. The agent is isolating the exact rejecting predicate before
  any relaxation; no live, provider, R2, or key state changed.
- 2026-08-01T00:05:18.0286128Z: Final re-review reproduced a control-flow
  bypass: an unrelated conditional branch could contain the expected
  verification call while the newly created object reached catch-driven delete
  without that verification. The binding proof remains useful, but lifecycle
  approval must require the returned awaited verification call on the created
  path before another review.
- 2026-08-01T00:14:27.0874925Z: Targeted re-review accepted the direct-return
  shape but reproduced an unchecked-argument bypass. The scanner constrained
  the first three arguments and final status without requiring the exact five
  arguments or exact backup-key binding, so a throwing intermediate expression
  could reach deletion before verification invocation. The repair is narrowed
  to exact signature and binding validation.
- 2026-08-01T00:19:54.9984504Z: Exact-argument re-review accepted arity and
  bindings but reproduced optional-call syntax. A canonical five-argument
  `verifyStoredBackup?.(...)` expression could skip invocation yet still earn
  cleanup approval. The final syntax check must reject a call-level optional
  token explicitly.
- 2026-08-01T00:27:49.9551896Z: Closed after optional-call rejection, exact
  binding/signature/lifecycle enforcement, 51 focused R2 tests, 119 combined
  Task 6 tests, TypeScript, documentation, the actual release security entry,
  and the complete repository gate all passed. Final review reported no High or
  Medium issue. Its sole Low advisory permits harmless parentheses around the
  same direct lexical callee; optional and computed variants fail closed.
