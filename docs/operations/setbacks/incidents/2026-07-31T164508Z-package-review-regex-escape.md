# SB-20260731-164508-package-review-regex-escape: Package reviewer used a malformed composite search expression

- **Status:** closed
- **First observed:** 2026-07-31T16:45:08.1021012Z
- **Last observed:** 2026-07-31T16:45:08.1021012Z
- **Phase/task:** Phase B Task 3 third sanitized package review
- **Environment:** Read-only package review
- **Version/commit:** 6f7c7be

## Symptom

A reviewer escaped a literal function-call token incorrectly inside a
composite `Select-String` regular expression, so the read-only query failed.

## Impact

No file or external state changed, and no source outside the sanitized package,
secret, URL, identifier, or runtime value was read or emitted.

## Cause classification

- **Confirmed cause:** A literal call token with an opening parenthesis was
  passed as malformed regular-expression syntax.
- **Hypotheses:** None remaining.
- **Known exclusions:** The package and review assignment remain valid.

## Correction and prevention

- **Correction:** Continue with simple literal searches inside the same
  package-only boundary.
- **Prevention:** Use literal search mode for code-call tokens unless regex
  behavior is required.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Recurrence history

- 2026-07-31T16:45:08.1021012Z: First observed and closed after selecting the
  literal-search fallback.
