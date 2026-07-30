# SB-20260730-193628-review-package-crlf-marker-check: Review package marker check rejected CRLF headings

- **Status:** closed
- **First observed:** 2026-07-30T19:36:28.373851Z
- **Last observed:** 2026-07-30T19:38:15.4773377Z
- **Phase/task:** Phase B live-acceptance closure Task 1 independent review
- **Environment:** Local ignored review package on Windows PowerShell
- **Version/commit:** `6bd0e450885b3c3aa38f3ba38289e1371b3cbb43`

## Symptom

A generated review package contained the required headings, but the validation command reported every heading marker absent.

## Impact

Task 1 independent review was delayed; no product code, deployment, provider state, or private data was affected.

## Reproduction conditions

Read the CRLF-formatted package as one raw string, then test section headings
with a line-end expression that accepts only LF. The companion checks also
expected an abbreviated header and full-length commit-list hashes even though
the package intentionally carries a full-hash header and abbreviated commit
list.

## Safe evidence

The package was nonempty, all three headings were present when the expression
accepted an optional carriage return, and it contained zero URL tokens. The
first corrected probe still rejected only the header and commit-count
assumptions; a safely redacted structural sample confirmed the actual formats.

## Attempts and outcomes

- The original marker expressions reported all three headings absent.
- Allowing `\r?` before each line end recognized all three headings.
- Inspecting a hash-redacted structural sample established that the header uses
  full hashes and the commit list uses an abbreviated hash.

## Cause classification

- **Confirmed cause:** The validator encoded three incorrect representation
  assumptions: LF-only heading endings, abbreviated hashes in the header, and
  full hashes in the commit-list line.
- **Hypotheses:** None.
- **Rejected hypotheses:** The package was not missing or empty, and its
  section headings were not absent.
- **Known exclusions:** No tracked implementation, provider state, deployment,
  or private value changed.

## Correction and prevention

- **Correction:** Validate headings with CRLF-tolerant expressions, compare the
  exact full-hash header, and count the package's abbreviated commit-list
  representation.
- **Prevention:** Review-package validation must derive expected base and head
  formats from the package contract and normalize line endings before judging
  structure.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected validator exited successfully and confirmed one exact full-hash
header, one commits heading, one files-changed heading, one diff heading, one
abbreviated commit-list entry, 22 diff file sections, a nonempty package, and
zero URL tokens.

## Recurrence history

- 2026-07-30T19:36:28.373851Z: First observed.
