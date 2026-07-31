# SB-20260731-135541-task3-resolver-docs-check-regression: Resolver repair failed documentation coverage

- **Status:** closed
- **First observed:** 2026-07-31T13:55:41.2373776Z
- **Last observed:** 2026-07-31T14:05:00.9419278Z
- **Phase/task:** Phase B Task 3 resolver final-review repair
- **Environment:** Main Phase B worktree; documentation coverage gate
- **Version/commit:** c5de12d plus owned resolver repair

## Symptom

The documentation coverage gate exited nonzero with 10 captured output lines
after resolver behavior and TypeScript checks passed.

## Impact

The resolver lane is not integration-ready until the simple and technical
references cover the final public API/contract shape.

## Reproduction conditions

Run documentation coverage after adding outer-boundary parameters,
skipped-duplicate semantics, and conservative uniqueness close to the resolver.

## Safe evidence

Compatibility cases, all 10 new tests, the complete 66-test resolver file, and
TypeScript passed. The docs gate produced 10 captured lines; no line content,
source payload, URI, credential, protected identifier, provider value,
argument list, or environment value was emitted.

## Attempts and outcomes

- Runtime behavior is fully green.
- TypeScript has zero diagnostics.
- Documentation coverage remains red.
- No stage, commit, provider action, or external mutation occurred.

## Cause classification

- **Confirmed cause:** Three new named helper functions required exact
  level-two backticked headings in both references, and one required attached
  JSDoc. Prose mentions and EOF placement did not satisfy the checker.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Runtime and static type behavior are not red.
- **Known exclusions:** Changes remain within four owned resolver paths.

## Correction and prevention

- **Correction:** Classify missing versus stale symbol coverage without
  emitting raw gate output, then update only the owned simple/technical
  resolver references.
- **Prevention:** Update both mirrored references immediately with public API
  changes and validate exact symbol coverage.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

All three helper functions now have the required source and mirrored reference
coverage. The documentation gate passed.

## Recurrence history

- 2026-07-31T13:55:41.2373776Z: First observed and contained after runtime and
  compiler success.
- 2026-07-31T13:59:47.7450613Z: The same documentation gate failed after both
  new contract sections were correctly appended at EOF. Seven missing
  categories remain, proving placement is not the cause and exact reference
  tokens or convention must be classified next.
- 2026-07-31T14:01:42.5533341Z: Adding the three exact helper tokens to both
  references left the same seven missing categories. The checker requires its
  formal per-function heading/anchor convention rather than token mentions in
  prose.
- 2026-07-31T14:05:00.9419278Z: Closed after exact helper headings and the
  missing attached JSDoc reduced documentation violations to zero.
