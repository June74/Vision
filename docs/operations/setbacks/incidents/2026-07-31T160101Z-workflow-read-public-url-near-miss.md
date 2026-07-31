# SB-20260731-160101-workflow-read-public-url-near-miss: Workflow inspection emitted public URL literals

- **Status:** closed
- **First observed:** 2026-07-31T16:01:01.7173180Z
- **Last observed:** 2026-07-31T16:17:56.4875463Z
- **Phase/task:** Phase B Task 3 workflow blocker repair
- **Environment:** Bounded local workflow source inspection
- **Version/commit:** 6dfdd38 plus concurrent test-first repairs

## Symptom

A bounded workflow-source read included two existing public provider endpoint
URL literals.

## Impact

No authentication value, callback, token, code, secret, personal identifier,
provider account identifier, edit, network request, or external mutation was
involved. The stricter Phase B no-URL output rule was nevertheless crossed.

## Cause classification

- **Confirmed cause:** Bounded line-count inspection did not also redact
  URL-shaped source lines.
- **Hypotheses:** None remaining.
- **Known exclusions:** No sensitive or user-specific URL was involved.

## Correction and prevention

- **Correction:** Redact every URL-shaped source line before any further
  workflow inspection output.
- **Prevention:** Apply both size bounds and URL redaction to local workflow
  reads in privacy-strict lanes.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Confirm a redacted bounded read succeeds before
  continuing implementation.

## Recurrence history

- 2026-07-31T16:01:01.7173180Z: First observed and contained before edits.
- 2026-07-31T16:17:56.4875463Z: Closed after all subsequent workflow reads
  applied URL-line redaction and no further URI-shaped output occurred.
