# SB-20260730-022329-backup-namespace-anchor-too-narrow: Backup namespace anchor expected an immediate closing code tick

- **Status:** closed
- **First observed:** 2026-07-30T02:23:29.3530445Z
- **Last observed:** 2026-07-30T02:24:21.2469115Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 5
- **Environment:** Local Phase B linked worktree
- **Version/commit:** Uncommitted cleanup-contract hardening based on `3b735be`

## Symptom

The strengthened operations-content test reported that the retained
`backup-and-restore.md` namespace anchor was missing.

## Impact

The first hardened default cleanup run failed one assertion. No runtime,
provider, browser, network, Git metadata, or external state changed.

## Reproduction conditions and safe evidence

The test expected a closing Markdown code tick immediately after
`backups/v1/`, while the manual correctly continues with the documented
`YYYY/MM/DD/...` object shape inside the same code span.

## Attempts and outcomes

- The anchor scan matched every other active-manual anchor.
- Direct text inspection confirmed the permanent namespace is present three
  times as a longer path.
- The regex was narrowed to the stable namespace prefix without requiring an
  immediate closing code tick.

## Cause classification

- **Confirmed cause:** The content anchor modeled a short standalone code span
  instead of the manual's longer object path.
- **Hypothesis:** The backup manual might have lost the permanent namespace.
- **Rejected hypothesis:** Direct inspection found the namespace in three
  longer documented object paths; only the anchor punctuation was wrong.
- **Known exclusions:** Backup behavior, namespace, key version, retention,
  delete behavior, and documentation content were unchanged.

## Correction and prevention

- **Correction:** Match the stable backticked `backups/v1/` prefix.
- **Prevention:** Inspect the exact retained content shape before pinning
  punctuation at the end of an anchor.
- **Owner:** Codex.
- **Next diagnostic step:** None; both focused modes now have the intended
  result.

## Verification and related work

The corrected default cleanup suite passed all eight tests. Strict future
cleanup produced the expected three failures and five passes while naming the
four active manuals, 39 shared paths, and 60 dedicated paths.
