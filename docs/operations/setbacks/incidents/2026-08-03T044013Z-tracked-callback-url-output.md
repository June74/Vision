# SB-20260803-044013-tracked-callback-url-output: Cron lookup printed an unrelated tracked callback URL

- **Status:** closed
- **First observed:** 2026-08-03T04:40:13.7189769Z
- **Last observed:** 2026-08-03T04:40:13.7189769Z
- **Phase/task:** Phase B corrected-controller schedule preflight
- **Environment:** Local tracked preview configuration
- **Version/commit:** Candidate `c1911f8`; candidate not deployed

## Symptom

A local command intended to confirm the two cron expressions emitted the whole
tracked configuration object, including an unrelated callback URL that project
handling rules prohibit repeating.

## Impact

One already tracked non-secret URL appeared in local tool output. No secret,
authorization code, token, account identifier, database URL, encryption key,
email, or protected calendar content was exposed, and no state changed.

## Safe evidence

The excessive output came from a tracked configuration file. The prohibited
value is not copied into this incident.

## Cause classification

- **Confirmed cause:** `Select-String` was applied to one raw multiline string,
  so a match caused the entire configuration string to be emitted.
- **Known exclusions:** No external response or secret store was queried.

## Correction and prevention

- **Correction:** Retain only the two already known cron literals and discard
  the excessive output from further use.
- **Prevention:** Parse JSONC or read bounded lines; never pipe a raw multiline
  configuration string through a matcher when output minimization is required.
- **Owner:** Codex.

## Verification and related work

The required cron values were confirmed without needing any unrelated field.
No key rotation or remediation is required.

## Recurrence history

- 2026-08-03T04:40:13.7189769Z: First occurrence, immediately contained.
