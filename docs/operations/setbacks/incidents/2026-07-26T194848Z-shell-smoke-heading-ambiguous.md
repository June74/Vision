# SB-20260726-194848-shell-smoke-heading-ambiguous: Shell smoke heading locator was ambiguous

- **Status:** closed
- **First observed:** 2026-07-26T19:48:48.710754Z
- **Last observed:** 2026-07-26T19:50:31.6114090Z
- **Phase/task:** Phase B temporary backup deployment
- **Environment:** Guarded GitHub preview workflow
- **Version/commit:** `28e12b8`

## Symptom

The guarded workflow browser smoke test matched both the brand heading and a longer status heading.

## Impact

All application checks and 28 browser tests passed, but deployment was blocked before any live change.

## Reproduction conditions

Render both the exact brand heading and the longer temporary-unavailable
status heading, then query a heading by the non-exact name `Vision`.

## Safe evidence

The application checks passed. The browser run reported 28 passes and one
strict-locator failure before deployment.

## Attempts and outcomes

- The first guarded run failed before deployment.
- The safe error category identified an ambiguous accessible-name locator.
- The local test now requests the exact brand heading.

## Cause classification

- **Confirmed cause:** Playwright accessible-name matching was not exact, so
  the short brand name also matched the longer operational heading.
- **Hypotheses:** None recorded.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No application assertion failed, no deployment
  occurred, and no provider state changed.

## Correction and prevention

- **Correction:** Require the exact brand accessible name in the smoke test.
- **Prevention:** Use exact matching for short landmark names that are prefixes
  of valid status copy.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Run the full local browser suite and then rerun the
  guarded workflow.

## Verification and related work

The full local browser suite exited zero with all 29 tests passing, including
the corrected shell smoke test.

## Recurrence history

- 2026-07-26T19:48:48.710754Z: First observed.
