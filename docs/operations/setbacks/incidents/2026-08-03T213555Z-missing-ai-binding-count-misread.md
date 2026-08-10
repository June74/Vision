# SB-20260803-213555-missing-ai-binding-count-misread: Optional AI binding was miscounted as present

- **Status:** closed
- **First observed:** 2026-08-03T21:35:55.161883Z
- **Last observed:** 2026-08-03T21:39:36.4134641Z
- **Phase/task:** Phase B candidate deployment failure diagnosis
- **Environment:** Local generated preview-config inspection plus approved read-only Cloudflare capability checks
- **Version/commit:** candidate `c1911f82c0fb274e3d50d20c3cbe82ba2abceb51`; diagnostic only

## Symptom

A quick PowerShell config summary reported one AI binding even though the optional ai property is absent, leading to a short-lived incorrect hypothesis that the candidate added Workers AI.

## Impact

No file or provider state changed, but an incorrect diagnostic conclusion was communicated and required immediate correction; AI is now ruled out as the blocker.

## Reproduction conditions

Count an optional nested config value with an array expression before proving
that the parent property exists, then treat the count as evidence of a binding.

## Safe evidence

An explicit null/property inspection reported `AiPresent=false`; the active
version reported zero AI bindings, and a response-discarding Workers AI model
probe proved the account capability is accessible.

## Attempts and outcomes

The initial aggregate summary produced the incorrect count and hypothesis. An
explicit property check immediately falsified it, the user-facing correction
was issued, and no AI configuration or provider action was attempted.

## Cause classification

- **Confirmed cause:** Presence was inferred from an aggregate count instead of
  an explicit null/property check.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The candidate adds a Workers AI binding; Workers AI
  is disabled or inaccessible for the account.
- **Known exclusions:** Candidate and active configurations both have no AI
  binding. No source, provider, key, secret, or deployment state changed.

## Correction and prevention

- **Correction:** Test optional binding presence explicitly before counting or
  comparing it.
- **Prevention:** Resource-difference diagnostics must emit both a presence
  boolean and a separately validated count; no hypothesis may be promoted from
  a count alone.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

Explicit local config presence, active-version binding count, and read-only
Workers AI access checks all agree that AI is not the upload blocker.

## Recurrence history

- 2026-08-03T21:35:55.161883Z: First observed.
- 2026-08-03T21:39:36.4134641Z: Incorrect hypothesis corrected and explicit
  checks verified; incident closed.
