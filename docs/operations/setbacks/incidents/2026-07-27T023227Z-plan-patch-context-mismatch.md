# SB-20260727-023227-plan-patch-context-mismatch: Plan patch context did not match wrapped text

- **Status:** closed
- **First observed:** 2026-07-27T02:32:27Z
- **Last observed:** 2026-07-28T20:40:45.2724773Z
- **Phase/task:** Phase B acceptance instrumentation Task 3 replacement brief
- **Environment:** Local Phase B worktree
- **Version/commit:** `36f9df2`

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
- 2026-07-28T00:21:07.6543342Z: Recurred when a large plan amendment copied a
  rendered encoding artifact instead of the exact dash stored in the file.
  The patch was rejected atomically and no plan content changed. The retry uses
  smaller hunks with short ASCII anchors read directly from the current file.
- 2026-07-28T00:22:02.8212591Z: The next small hunk still used the rendered
  artifact because the default PowerShell decoder was reused. It was rejected
  atomically. The exact UTF-8 lines were then read explicitly before retrying.
- 2026-07-28T18:56:00.0725316Z: Recurred when the setback index patch used a
  rounded timestamp instead of the helper's exact generated timestamp. The
  combined patch was rejected atomically; exact current lines were read before
  the retry.
- 2026-07-28T18:56:39.1904429Z: The retry then used the incident heading
  instead of the index row's shorter title. It was also rejected atomically.
  Minimal exact row-specific hunks succeeded; no source, workflow, provider,
  or private state changed in either failed attempt.
- 2026-07-28T19:51:22.5993220Z: Recurred when a bulk test migration supplied
  more identical replacement hunks than the file contained. The first patch
  and an index-title retry were rejected atomically. Bounded searches then
  supplied the exact fixture count and current index title.
- 2026-07-28T20:40:02.5496749Z: Recurred when the ignored Task 3 brief patch
  assumed controller-resolution lines were already present. The patch was
  rejected atomically, no brief content changed, and the exact current header
  was read before retrying with a short insertion anchor.
- 2026-07-28T20:40:45.2724773Z: The short-anchor retry was also rejected
  against the ignored CRLF brief despite the rendered header match. No file
  changed. The correction is to create a new versioned ignored brief instead
  of repeatedly patching the existing generated artifact.
