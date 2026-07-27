# SB-20260727-023227-plan-patch-context-mismatch: Plan patch context did not match wrapped text

- **Status:** closed
- **First observed:** 2026-07-27T02:32:27Z
- **Last observed:** 2026-07-27T02:32:27Z
- **Phase/task:** Phase B restore implementation plan
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
