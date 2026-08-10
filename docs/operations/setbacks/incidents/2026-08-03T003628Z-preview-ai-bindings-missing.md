# SB-20260803-003628-preview-ai-bindings-missing: Normal preview cannot satisfy the approved AI binding contract

- **Status:** closed
- **First observed:** 2026-08-03T00:36:28.2471845Z
- **Last observed:** 2026-08-03T04:57:39.6452989Z
- **Phase/task:** Phase B OAuth reconnect Task 5 corrected candidate retry and AI live acceptance
- **Environment:** Read-only rolled-back Cloudflare preview inspection
- **Version/commit:** Candidate `c1911f8`; rollback `94b8810`

## Symptom

The corrected controller passed artifact, authentication, active-version,
exact-health, environment, and temporary-binding checks, then the normal
provider binding contract rejected the active preview inventory.

## Impact

The approved candidate redeployment remains intentionally blocked. Deploying
now would inherit an incomplete AI runtime contract and would immediately
require rollback. No deployment or provider mutation was attempted.

## Reproduction conditions

Validate the active preview version against the exact normal 24-binding
contract before the existing Gateway's canonical base URL has been configured
as a preview-only Worker secret.

## Safe evidence

A read-only, value-free comparison reported 22 active bindings against 24
expected bindings. Subsequent owner UI inspection confirmed that
`OPENAI_GATEWAY_BASE_URL` is absent. The exact name/type state of
`OPENAI_API_KEY` remains pending independent verification. No secret values or
provider identifiers were read or rendered.

## Cause classification

- **Confirmed cause:** The canonical `OPENAI_GATEWAY_BASE_URL` Worker binding is
  absent.
- **Contributing cause:** The existing AI Gateway was not located in the first
  viewed dashboard surface, delaying retrieval of its canonical base URL.
- **Unverified state:** The exact name/type state of `OPENAI_API_KEY` still
  requires independent confirmation.
- **Hypotheses:** None remaining for the provider-contract mismatch.
- **Rejected hypotheses:** Candidate source, rollback source, binding provider
  types, plain-text variables, temporary acceptance state, health, and
  schedules.
- **Known exclusions:** The preview backup key remains version 1 and was not
  read, changed, or rotated.

## Correction and prevention

- **Correction:** Locate and freshly verify the existing approved
  `vision-preview` Gateway and its exact $9.50 rule, then add its canonical base
  URL as a preview Worker secret without sharing the value. Independently
  verify the exact `OPENAI_API_KEY` name/type before rerunning the controller
  gate.
- **Prevention:** Treat provider budget configuration and Worker runtime-secret
  configuration as separate required acceptance gates.
- **Owner:** AI integration owner and Codex verifier.
- **Next diagnostic step:** Perform a read-only existing-Gateway identity/rule
  check, then complete the two binding name/type checks before rerunning
  `validate_current_rollback` with approved network access.

## Verification and related work

The owner reported configuring both entries. A fresh nonce-bound baseline run
passed live schedule and deployment-shape gates but stopped at
`provider_binding_contract_invalid`. The exact current name/type mismatch is
not yet known; the candidate was not redeployed and no value was exposed.
The owner subsequently located the existing Gateway, derived the required
provider-native OpenAI base URL without sharing it, and reported saving the
missing Worker secret. Exact active-version name/type verification remains
pending. A fresh controller baseline then verified both required binding names
and encrypted-secret types on the active version without reading either value.

## Recurrence history

- 2026-08-03T00:36:28.2471845Z: First conclusively proven by exact active
  version binding-name and provider-type comparison.
- 2026-08-03T04:08:31.5638225Z: Owner configuration advanced validation to the
  provider contract, which remains invalid; exact two-row name/type inspection
  requested without values.
- 2026-08-03T04:10:22.5770599Z: Owner UI inspection confirmed
  `OPENAI_GATEWAY_BASE_URL` is absent; `OPENAI_API_KEY` name/type still requires
  exact confirmation.
- 2026-08-03T04:15:11.0000000Z: Owner clarified that no AI Gateway exists.
  That absence conclusion was later superseded by Cloudflare's duplicate-name
  refusal and the historical creation record.
- 2026-08-03T04:20:30.5738755Z: Exact-name creation was rejected as a duplicate.
  No mutation occurred; the existing Gateway must be located and re-verified.
- 2026-08-03T04:40:13.7189769Z: Owner reported saving
  `OPENAI_GATEWAY_BASE_URL` as a Worker secret; the controller must now verify
  the binding without reading its value.
- 2026-08-03T04:57:39.6452989Z: Fresh nonce-bound baseline passed the exact
  provider binding contract. Incident closed before candidate deployment.
