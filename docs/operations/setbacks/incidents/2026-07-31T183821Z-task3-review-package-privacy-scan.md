# SB-20260731-183821-task3-review-package-privacy-scan: Raw Task 3 review artifact failed strict content privacy checks

- **Status:** closed
- **First observed:** 2026-07-31T18:38:21.2782676Z
- **Last observed:** 2026-07-31T18:40:54.3304219Z
- **Phase/task:** Phase B Task 3 fifth review-package preparation
- **Environment:** Local ignored review artifact
- **Version/commit:** 7d78e14

## Symptom

The raw 78-path Git diff excluded incident files and contained no email
addresses, but a strict package scan still found URL-like text,
callback-parameter examples, sensitive-looking literal assignments, and one
generic setback-path reference from the Task 3 report.

## Impact

The artifact was not sent to reviewers. It must be transformed into a
structurally equivalent sanitized package before delegation. No provider,
network, environment, secret, staging, or commit was touched.

## Cause classification

- **Confirmed cause:** A raw source diff preserves test fixtures and
  documentation examples that the stricter review-artifact policy forbids even
  when they are not live credentials.
- **Hypotheses:** The generic setback reference is report prose rather than an
  incident diff header; exact path-level counts will confirm scope without
  printing matched values.
- **Known exclusions:** The package has exactly 78 diff headers and zero email
  addresses, and no reviewer received it.

## Correction and prevention

- **Correction:** Identify matched paths by count only, replace prohibited
  values with stable typed redactions without altering diff headers or code
  structure, and require zero matches before delegation.
- **Prevention:** Treat raw package generation and privacy-safe package
  sanitization as separate mandatory steps.
- **Owner:** Codex.
- **Next diagnostic step:** Produce path-and-count metadata only for each
  prohibited pattern class.

## Recurrence history

- 2026-07-31T18:38:21.2782676Z: Observed and contained before reviewer access.
- 2026-07-31T18:40:54.3304219Z: Closed after stable typed redactions preserved
  all 78 diff headers while the final scan reported zero setback references,
  URLs, emails, standalone callback parameters, and sensitive literal
  assignments.
