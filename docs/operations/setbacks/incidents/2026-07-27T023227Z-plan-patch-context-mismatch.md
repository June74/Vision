# SB-20260727-023227-plan-patch-context-mismatch: Plan patch context did not match wrapped text

- **Status:** closed
- **First observed:** 2026-07-27T02:32:27Z
- **Last observed:** 2026-08-01T02:26:27.5590215Z
- **Phase/task:** Phase B Task 7 continuation and exact-candidate report refresh
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
- 2026-07-28T22:23:26.3813087Z: Three combined setback patches used an
  incorrect multi-hunk assumption or nonexistent trailing context. They were
  rejected atomically. No file changed, and separate exact hunks succeeded.
- 2026-07-29T02:45:00Z: Recurred when the first Task 4 RED patch used a
  remembered AI-evidence test title rather than its exact current text. The
  multi-file patch was rejected atomically. The target files were reread, and
  the retry is split into exact file-sized patches.
- 2026-07-29T03:30:16Z: Recurred when the Task 5 safe-tail test patch used a
  guessed describe label. The patch was rejected atomically before any test
  changed; the exact test section was then read for a short-anchor retry.
- 2026-07-29T03:40:00Z: A large safe-tail reference restoration patch had one
  malformed added line. It was rejected atomically; no documentation changed.
  The retry uses concise exact-heading restoration patches.
- 2026-07-30T04:59:44.7681467Z: Recurred when one combined implementation-plan
  consistency patch used a context block that did not exactly match the
  generated Task 5 text. The patch was rejected atomically and changed no file.
  The current Task 4 and Task 5 sections were reread; retries use small exact
  hunks.
- 2026-07-30T05:22:14.1104599Z: Recurred when a combined AI observer-window
  plan patch used stale Task 4 line wrapping. The patch was rejected atomically
  and changed no file. The retry uses exact bounded reads and small hunks.
- 2026-07-30T17:37:28.5621632Z: Recurred when the controller implementation
  paragraph was patched with context from before the new RED step insertion.
  The patch was rejected atomically and changed no file. The retry uses the
  exact current bounded lines and a shorter anchor.
- 2026-07-30T18:05:11.1098965Z: Recurred when a combined setback correction
  used the incident heading as the index title. The patch was rejected
  atomically and changed no file. The exact current index rows were read before
  separate minimal retries.
- 2026-07-30T18:05:57.8089561Z: Recurred when two independently verified index
  rows were still combined in one patch and the second hunk was rejected. The
  patch was atomic and changed no file. Each row is retried as its own
  one-line patch.
- 2026-07-30T18:38:54.9161685Z: Recurred when a combined maintenance-binding
  plan patch used one stale wrapped controller sentence. The patch was rejected
  atomically and changed no file. The exact current sections were reread and
  the correction is split into small verified hunks.
- 2026-07-30T18:45:10.2706640Z: Recurred when a combined design-spec
  consistency patch assumed one paragraph wrapped differently. The patch was
  rejected atomically and changed no file. All remaining spec corrections use
  one exact hunk per patch.
- 2026-08-01T01:47:18.3849506Z: Recurred when a combined handoff-ledger patch
  assumed the truncation incident header matched its newer index timestamp.
  The patch was rejected atomically and changed no file. The exact incident
  headers were reread and the ledger update was split into small exact hunks.
- 2026-07-31T21:02:25.7615346-05:00: Recurred when the first Task 7
  continuation ledger patch expected the index timestamp in the incident
  header. The patch was rejected atomically and changed no file. The exact
  current incident lines were reread before the retry.
- 2026-08-01T02:26:27.5590215Z: Recurred when the final ignored-report update
  used a shortened version of the current candidate paragraph. The combined
  patch was rejected atomically and changed no file. The exact report tail was
  reread before separate minimal updates.
