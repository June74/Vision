# Task 8 diff check used an incompatible line-ending override

- **Occurred:** 2026-08-02T01:03:03Z
- **Status:** closed
- **Phase:** Phase B / tracked correlation repair / Task 8 exact-diff freeze
- **Category:** verification configuration error

## What happened

The first combined whitespace check forced Git's automatic line-ending handling off in a CRLF working tree. Git then interpreted carriage returns across the candidate as trailing whitespace and emitted a large false-positive report.

## Impact

The diagnostic was read-only and changed no file, provider, deployment, credential, or live state. Its whitespace findings are invalid and must not be used for admission.

## Corrective action

- Rerun `git diff --check` with the repository's normal line-ending configuration.
- Suppress diagnostic detail and capture only the exit status for the candidate and authoring range.
- Keep the separate untracked-file whitespace check, which reads file text directly.

## Prevention

Do not override `core.autocrlf` for working-tree whitespace validation. Repository line-ending policy is part of the comparison boundary.

## Closure

The corrected candidate and authoring-range `git diff --check` commands both passed. All non-ignored untracked candidate files also passed direct trailing-whitespace and final-newline checks.
