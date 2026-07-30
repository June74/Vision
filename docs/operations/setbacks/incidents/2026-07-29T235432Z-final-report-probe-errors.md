# SB-20260729-235432-final-report-probe-errors: Final report probe used invalid PowerShell assumptions

- **Status:** closed
- **First observed:** 2026-07-29T23:54:32Z
- **Last observed:** 2026-07-30T01:36:33.4050170Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 4
- **Environment:** Local Phase B worktree
- **Version/commit:** Post-implementation reporting after `8bf5d4a`

## Symptom

The first ignored-report probe placed a pipeline directly after a `foreach`
statement, which PowerShell rejected as an empty pipe element. A follow-up
directory probe also assumed that setbacks lived under `.superpowers`, while
this repository stores them under `docs/operations/setbacks/incidents`.
During the wave-3 preflight, a status-count probe used the wildcard expression
`??*` as if it meant a literal Git `??` prefix; PowerShell treated both
question marks as wildcards and misclassified every status entry.

## Impact

Neither read-only probe changed application files, Git state, generated
artifacts, provider state, or production state. The reporting handoff was
briefly delayed.

## Cause classification

- **Confirmed cause:** The diagnostic command used invalid PowerShell pipeline
  structure, an unverified directory assumption, and later a wildcard where a
  literal prefix test was required.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The errors were not caused by the implementation,
  tests, Git commit, or sandbox permissions.
- **Known exclusions:** No deployment or external service call occurred.

## Correction and prevention

- **Correction:** Build an explicit result array before conversion to JSON and
  discover repository paths before probing them. For Git status
  classification, use `StartsWith('??')`.
- **Prevention:** Keep PowerShell collection pipelines outside compound
  statements and verify repository-specific operational paths with a
  non-recursive directory check first. Use literal string methods for Git
  porcelain prefixes.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The probes were read-only. The corrected literal-prefix audit reported the
exact current HEAD, four tracked entries, one untracked incident record, and
the five safe repository-relative paths without misclassification.

## Recurrence history

- 2026-07-29T23:54:32Z: First observed and corrected.
- 2026-07-30T00:19:33.7014177Z: A wave-3 preflight status counter used a
  wildcard instead of a literal `??` prefix test. The displayed paths remained
  accurate, but the category counts were discarded pending a corrected probe.
- 2026-07-30T01:36:33.4050170Z: A wave-4 ignored-report whitespace probe used
  PowerShell's backtick notation inside a regex character class, so it counted
  lines ending in the letter `t`. The false count was discarded; the corrected
  regex uses `[ \t]+$` and scans the appended wave-4 section explicitly.
