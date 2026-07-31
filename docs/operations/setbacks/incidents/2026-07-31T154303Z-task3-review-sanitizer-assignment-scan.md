# SB-20260731-154303-task3-review-sanitizer-assignment-scan: Task 3 review sanitizer left conservative assignment matches

- **Status:** closed
- **First observed:** 2026-07-31T15:43:03.3618269Z
- **Last observed:** 2026-07-31T15:44:07.1469286Z
- **Phase/task:** Phase B Task 3 second final package re-review
- **Environment:** Local sanitized review-package generation
- **Version/commit:** 0c427db

## Symptom

The regenerated package had the exact 77-path scope, zero setback paths, zero
URLs, and zero email addresses, but the conservative sensitive-assignment scan
still reported 35 matches.

## Impact

The package was not dispatched or opened by reviewers. No secret value,
provider identifier, protected data, network request, external mutation, or
deployment occurred.

## Cause classification

- **Confirmed cause:** The sanitizer and post-scan did not yet agree on how to
  classify whitespace and code-shaped assignments after protected variable
  names.
- **Hypotheses:** The remaining matches are redaction markers reached through
  regex backtracking or non-value code forms.
- **Known exclusions:** Scope, URL, email, and setback-path gates passed.

## Correction and prevention

- **Correction:** Make the assignment sanitizer and validator use the same
  whitespace-aware boundary, regenerate from Git, and require zero matches.
- **Prevention:** Never dispatch a review package unless every privacy counter
  is zero except the explicit redaction-marker count.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Inspect aggregate match categories only, without
  printing matched lines or values.

## Recurrence history

- 2026-07-31T15:43:03.3618269Z: First observed and contained before dispatch.
- 2026-07-31T15:44:07.1469286Z: Closed after line-complete protected-name
  redaction produced the exact 77-path package with zero setback paths, URLs,
  emails, or unsafe sensitive assignments.
