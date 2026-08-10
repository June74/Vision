# SB-20260803-003126-corrected-controller-network-sandbox: Corrected controller authentication failed inside the restricted sandbox

- **Status:** contained
- **First observed:** 2026-08-03T00:31:26.8464060Z
- **Last observed:** 2026-08-10T01:28:14.3990824Z
- **Phase/task:** Phase B OAuth reconnect Task 5 corrected candidate retry
- **Environment:** Default restricted sandbox and approved network boundary
- **Version/commit:** Candidate `c1911f8`; rollback `94b8810`

## Symptom

The corrected controller and the same suppressed Wrangler read operations
returned an authentication-stage failure inside the default sandbox.

## Impact

The dry run stopped before any deployment or provider mutation. No Worker
version, setting, schedule, binding, Google state, database state, calendar,
credential, or key changed.

## Reproduction conditions

Run the privacy-safe live-state controller where outbound provider access is
restricted, then repeat the exact read-only mode through the approved network
boundary.

## Safe evidence

Only exit codes, fixed categories, and Boolean classifier results were
retained. Raw Wrangler output, provider identifiers, URLs, account data, and
credential material were suppressed.

## Cause classification

- **Confirmed cause:** The default sandbox could not complete Wrangler's
  provider requests.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Invalid Wrangler credentials or controller
  arguments; the approved identical mode passed authentication and active
  version attribution.
- **Known exclusions:** No provider mutation or secret read occurred.

## Correction and prevention

- **Correction:** Run only the privacy-safe live provider boundary with
  approved network access.
- **Prevention:** Treat Wrangler authentication, deployment, version, and
  health checks as explicit network operations and suppress all raw output.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The approved identical controller run reached the exact provider-binding
validator, proving the network-only classification.

On 2026-08-10, a read-only preview-health preflight from the restricted
PowerShell sandbox again could not connect to the remote server. No HTTP status,
body, credentials, or provider mutation was obtained. The failure is treated as
the same sandbox network boundary, not as evidence that the deployed Worker is
unhealthy.

## Recurrence history

- 2026-08-03T00:31:26.8464060Z: First observed and contained before mutation.
- 2026-08-03T00:36:28.2471845Z: Closed after the approved read-only retry
  passed authentication and active-version attribution.
- 2026-08-10T01:09:31Z: Read-only preview-health preflight reproduced the
  restricted-sandbox network failure; status changed to contained pending the
  approved outside-sandbox preflight.
- 2026-08-10T01:28:14.3990824Z: A second read-only preview-health preflight
  from the restricted sandbox returned the same safe
  `health_request_or_decode_failed` category before an HTTP response. No
  provider or private state changed; the outside-sandbox path remains the
  approved diagnostic boundary.
