# Task 8 fail-closed test patch used multiline context for an escaped fixture

- **Occurred:** 2026-08-02T01:16:45.8870682Z
- **Status:** closed
- **Phase:** Phase B / tracked correlation repair / Task 8 exact-tip finding repair
- **Category:** patch context mismatch

## What happened

The first test-only patch treated a synthetic YAML fixture as a multiline source block, but that fixture is stored as one template string containing escaped newlines. Patch verification rejected the complete patch before applying any hunk.

## Impact

No implementation, test, provider, deployment, credential, key, or live state changed. The required RED contract has not yet been run.

## Corrective action

- Apply smaller exact hunks to the parsed and textual workflow tests.
- Update the escaped fixture with escaped syntax in a separate hunk.
- Run the focused tests before changing the workflow.

## Prevention

When a displayed source line contains embedded newline escapes, inspect and patch that fixture independently instead of combining it with ordinary multiline context.

## Closure

The smaller exact test hunks applied successfully. The focused RED failed only the three new assertions, and the one-line workflow repair then produced a 40-of-40 GREEN result.
