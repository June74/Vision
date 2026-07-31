# SB-20260731-035029-task3-controller-diagnosis-test-name-mismatch: Controller diagnosis used an invalid combined literal test locator

- **Status:** closed
- **First observed:** 2026-07-31T03:50:29.8919463Z
- **Last observed:** 2026-07-31T03:59:01.8377261Z
- **Phase/task:** Phase B Task 3 controller full-file regression diagnosis
- **Environment:** Read-only isolated controller diagnosis agent
- **Version/commit:** 2bfbc23 plus uncommitted controller hardening

## Symptom

The diagnosis combined three distinct test names into one literal search
pattern, returning no matches. A corrected exact-array lookup found two blocks
but confirmed the expiry-boundary title differs from the structured report
label supplied to the scout.

## Impact

The expiry case diagnosis paused before a broader search. No file, test,
provider, network, Git, or external state changed.

## Reproduction conditions

Treat several distinct exact strings as one literal pattern, or assume a
structured full test name exactly equals its nested source title.

## Safe evidence

The locator returned only match counts and the fact that two of three blocks
were found. No source snippet, protected value, identifier, or stream was
emitted.

## Attempts and outcomes

- The invalid combined literal returned zero matches.
- The exact pattern array found the latter two named blocks.
- The scout stopped before expanding beyond the nearby expiry-title cluster.

## Cause classification

- **Confirmed cause:** Incorrect literal-pattern construction followed by a
  nested-title mismatch.
- **Hypotheses:** The expiry wording is split between an enclosing suite and a
  shorter local test title.
- **Rejected hypotheses:** The target test is not missing from the structured
  report.
- **Known exclusions:** Repository, product, provider, and external state are
  unaffected.

## Correction and prevention

- **Correction:** Inspect only the nearby expiry-boundary title cluster, then
  continue the already bounded test/helper trace.
- **Prevention:** Use a pattern array for multiple exact names and distinguish
  structured full names from local nested titles.
- **Owner:** Codex.
- **Next diagnostic step:** Locate only the expiry-boundary cluster.

## Verification and related work

The replacement trace resolved the nested expiry title from its nearby cluster
and completed the three requested classifications without broader discovery.

## Recurrence history

- 2026-07-31T03:50:29.8919463Z: First observed and contained.
- 2026-07-31T03:59:01.8377261Z: Closed after exact nested-title resolution and
  count-free source tracing.
