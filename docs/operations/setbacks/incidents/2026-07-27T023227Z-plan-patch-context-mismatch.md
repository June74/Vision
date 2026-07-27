# SB-20260727-023227-plan-patch-context-mismatch: Plan patch context did not match wrapped text

- **Status:** closed
- **First observed:** 2026-07-27T02:32:27Z
- **Last observed:** 2026-07-27T19:17:18Z
- **Phase/task:** Phase B restore Task 3
- **Environment:** Local Phase B worktree
- **Version/commit:** `6fdb9cb`

## Symptom

A documentation-only patch was rejected because its context split a sentence
differently from the current plan file.

## Impact

No source, provider configuration, secret, key, or runtime state changed. Plan
editing paused long enough to read the exact current lines.

## Reproduction conditions

Apply a patch using remembered line wrapping instead of the exact text in the
working tree.

## Safe evidence

The patch tool reported that the expected documentation context was absent.
The immediately following bounded read showed the same sentence with a
different line break.

## Attempts and outcomes

- The first patch was rejected without modifying the plan.
- The exact bounded plan lines were read before the retry.

## Cause classification

- **Confirmed cause:** The patch used stale line-wrapping context.
- **Hypotheses:** None.
- **Rejected hypotheses:** The target content was not missing.
- **Known exclusions:** No code, provider state, or private value was involved.

## Correction and prevention

- **Correction:** Retry against the exact text returned by the bounded read.
- **Prevention:** Use short, distinctive context that does not depend on prose
  line wrapping.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The retry must modify only the intended plan paragraph and pass
`git diff --check`.

## Recurrence history

- 2026-07-27T02:32:27Z: First observed and contained.
- 2026-07-27T04:42:44Z: Recurred when a test-only patch used context copied
  from privacy-redacted inspection output. The patch was rejected atomically,
  `git diff` confirmed neither test changed, and the retry uses short anchors
  that do not include URL-bearing source.
- 2026-07-27T05:08:50Z: Recurred twice while updating the provider-URL
  incident because current Task 3 text differed from remembered patch
  context. Both patches were rejected atomically; the successful retry used
  exact current lines.
- 2026-07-27T19:17:18Z: Recurred when a locator-limitation recurrence used an
  outdated sentence fragment. The patch was rejected atomically; the retry
  copied the exact current tail before applying once.
