# Setback SB-20260801-173247-task8-static-callback-uri-output

- **Status:** contained
- **Detected:** 2026-08-01T17:32:47.1568710Z
- **Last observed:** 2026-08-01T17:32:47.1568710Z
- **Scope:** Phase B Task 8 local deploy-configuration inspection
- **Version/commit:** 10b228bc2c18647f6a8a19c2dd5ad740e7f7491e plus unstaged setback records

## What happened

A bounded source-symbol search displayed the configured static OAuth redirect
URI while locating the preview deploy validator. The value contained no query,
authorization code, state, token, secret, account, or private calendar data and
was already owner-provided, but the project boundary prohibits printing any
callback URL.

## Impact

The privacy presentation boundary was violated once in local read-only output.
No provider, deployment, Git, credential, calendar, database, R2, AI, or source
state changed. No authentication-bearing value was exposed.

## Cause classification

- **Confirmed cause:** The search returned literal matching source lines instead
  of a derived allowlisted Boolean/count summary.
- **Rejected hypothesis:** This was not a secret disclosure or live OAuth
  callback capture.

## Correction and prevention

- **Correction:** Discard the literal output and continue configuration checks
  through scripts that emit only booleans, counts, and closed categories.
- **Prevention:** Never print matching configuration source lines when a file
  can contain a redirect URI; parse locally and emit only allowlisted derived
  facts. Reject query-bearing URL output entirely.
- **Owner:** Codex.
- **Next diagnostic step:** Resume Task 8 local mapping with structured
  privacy-safe summaries only.

## Verification

The displayed value was static and query-free. No code, state, token, secret,
email, provider identifier, database URL, object key, or private content was
present, retained, or used for a live action.
