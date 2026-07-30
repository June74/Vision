# SB-20260730-005138-privacy-classifier-overbroad: Bounded privacy classifier produced unexplained matches

- **Status:** closed
- **First observed:** 2026-07-30T00:51:38.3303091Z
- **Last observed:** 2026-07-30T00:52:42.9611657Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 3
- **Environment:** Local Phase B worktree
- **Version/commit:** Uncommitted wave-3 fix based on `dc3a517`

## Symptom

A bounded content classifier over the changed files returned 49 aggregate
matches across several broad secret-shaped patterns.

## Impact

The privacy scan is not yet acceptable evidence. No matching text was printed,
copied, or added to a report, and no external action occurred.

## Reproduction conditions and safe evidence

The scan counted patterns for bearer-like text, key prefixes, credentialed
database locators, email-shaped text, and token-like triples. It emitted only
the total match count and safe static-scan counts.

## Cause classification

- **Confirmed cause:** The case-insensitive key-prefix expression admitted the
  plain word prefix `sk`, so safe skill-related index text produced all 49
  false positives.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The changed files contain a value matching the
  strict bearer, provider-key, credentialed-database, authorization-code,
  token-triple, or email shapes; the refined scan found zero.
- **Known exclusions:** Matching content was not rendered or transmitted.

## Correction and prevention

- **Correction:** Split counts by file and pattern identifier only, then
  required the exact hyphenated key prefix and longer provider-specific
  shapes without printing matched text.
- **Prevention:** Prefer repository security scanners and high-specificity
  value shapes over broad prose-sensitive expressions.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The safe file/pattern matrix isolated every broad match to the key-prefix
classifier. The refined scan covered all 15 changed files and returned zero
strict sensitive-value matches.

## Recurrence history

- 2026-07-30T00:51:38.3303091Z: First observed and contained.
- 2026-07-30T00:52:42.9611657Z: The high-specificity rerun returned zero
  matches and closed the incident.
