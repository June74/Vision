# SB-20260731-144451-task3-review-package-secret-assignment-shape: Review sanitizer left two sensitive assignment shapes

- **Status:** closed
- **First observed:** 2026-07-31T14:44:51.5694116Z
- **Last observed:** 2026-07-31T14:45:53.9986110Z
- **Phase/task:** Phase B Task 3 final package re-review
- **Environment:** Main Phase B worktree; generated ignored review artifact
- **Version/commit:** 73191b7

## Symptom

The URI/email sanitization pass left two added diff lines shaped like sensitive
configuration keys assigned to string literals.

## Impact

The package is not eligible for reviewer distribution until both right-hand
side values are redacted and the post-scan reaches zero.

## Reproduction conditions

Sanitize URI and email patterns without separately redacting string literals
assigned to the protected configuration-key allowlist.

## Safe evidence

Only the aggregate count of two was emitted. No matched line, value, source
payload, URI, credential, protected identifier, provider value, or environment
value was displayed or sent to a reviewer.

## Attempts and outcomes

- The generated package has exactly 75 diff headers.
- It has zero setback-file diff headers, remaining URIs, remaining emails, or
  null bytes.
- Review distribution stopped before any package handoff.

## Cause classification

- **Confirmed cause:** The first sanitizer covered URI/email patterns but not
  sensitive literal assignment shapes.
- **Hypotheses:** The literals may be placeholders, but they are treated as
  protected until redacted.
- **Rejected hypotheses:** No raw value was emitted by the scanner.
- **Known exclusions:** The committed source and provider state are unchanged.

## Correction and prevention

- **Correction:** Replace only the captured right-hand sides with one fixed
  redaction marker, preserving line structure and key names for review.
- **Prevention:** Require zero remaining sensitive literal assignments in every
  generated review package before distribution.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Redact in memory, rewrite the ignored artifact, and
  rerun all package privacy counts.

## Verification and related work

Both right-hand sides were replaced with the fixed secret-value marker. The
final package has 75 diff headers, zero setback-file headers, zero remaining
URIs or emails, zero unsafe sensitive literal assignments, and exactly two
secret-value redactions.

## Recurrence history

- 2026-07-31T14:44:51.5694116Z: First observed and contained before reviewer
  distribution.
- 2026-07-31T14:45:53.9986110Z: Closed after exact right-hand-side redaction
  and the complete package privacy post-scan passed.
