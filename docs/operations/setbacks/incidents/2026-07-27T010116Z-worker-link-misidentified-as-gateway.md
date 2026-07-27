# SB-20260727-010116-worker-link-misidentified-as-gateway: Worker link was misidentified as an AI Gateway

- **Status:** closed
- **First observed:** 2026-07-27T01:01:16Z
- **Last observed:** 2026-07-27T01:01:16Z
- **Phase/task:** Phase B preview AI Gateway configuration
- **Environment:** Cloudflare dashboard through browser control
- **Version/commit:** `22c5dc0`

## Symptom

A dashboard link labeled `vision-preview` was treated as the expected AI
Gateway even though its stored route did not contain the AI Gateway path.

## Impact

Diagnosis incorrectly focused on account and identity mismatches. Several
isolated workflow retries returned not-found or empty-list categories before
the link type was rechecked.

## Reproduction conditions

Use a shared product name as identity evidence without first validating the
link's product route.

## Safe evidence

The stored route contained the fixed product label but failed the fixed
AI-Gateway-path boolean. The provider API independently returned an empty
Gateway list.

## Attempts and outcomes

- The Worker and Gateway account routes were compared using the mislabeled
  link.
- Name, ID, and account hypotheses were tested and rejected.
- The original stored route was reclassified and proved to be outside the AI
  Gateway product path.

## Cause classification

- **Confirmed cause:** Shared visible naming was accepted without validating the
  resource type from its route.
- **Hypotheses:** None.
- **Rejected hypotheses:** The Gateway did not exist under another API ID or
  name.
- **Known exclusions:** No provider identifier or account value was emitted.

## Correction and prevention

- **Correction:** Navigate from the fixed AI Gateway product link and create
  exactly one approved Gateway.
- **Prevention:** Before inferring provider resource identity from visible text,
  validate both resource type and live route.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The API empty-list result and the non-Gateway link route now agree.

## Recurrence history

- 2026-07-27T01:01:16Z: First observed and closed after route reclassification.
