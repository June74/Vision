# SB-20260728-030600-cloudflare-secret-list-authentication-unavailable: CLI secret inventory lacked authentication

- **Status:** closed
- **First observed:** 2026-07-28T03:06:00Z
- **Last observed:** 2026-08-01T17:15:52.0738476Z
- **Phase/task:** Preview database role probe Task 2 and Phase B Task 8 reconciliation
- **Environment:** Local read-only Cloudflare diagnostic
- **Version/commit:** `979228b`

## Symptom

The name-only preview Worker secret inventory command exited with the fixed safe
category `authentication_unavailable`.

## Impact

The CLI could not independently verify secret presence. The signed-in dashboard
remained available and the probe did not advance without fresh name/type
evidence.

## Reproduction conditions and safe evidence

Run the captured name-only inventory command without an authenticated local
Wrangler session. Raw provider output remains captured and unreported.

## Cause classification

- **Confirmed cause:** The local CLI had no usable Cloudflare authentication.
- **Hypotheses:** None.
- **Rejected hypotheses:** Network and command-shape failures were not the safe
  classified categories.
- **Known exclusions:** The command was read-only and emitted no secret value,
  account identifier, provider identifier, authenticated URL, or token.

## Attempts and outcomes

1. The first inventory command exited nonzero.
2. A captured classifier returned only `authentication_unavailable`.
3. Fresh signed-in dashboard inventory remained the independent verification
   surface.

## Correction and prevention

- **Correction:** Use the signed-in dashboard for exact name/type inventory.
- **Prevention:** Do not assume browser authentication is shared with Wrangler;
  preflight CLI authentication before choosing it as an acceptance gate.
- **Owner:** Codex.
- **Next diagnostic step:** None.

## Verification and related work

The dashboard returned fixed exact counts without exposing secret values.

## Recurrence history

- 2026-08-01T17:15:07.9272107Z: The Task 8 read-only name inventory again
  exited nonzero while both streams were captured and discarded. No provider
  output, secret name/value, account data, URL, token, deployment, or mutation
  was displayed or retained. The exact fixed failure category remains to be
  classified before deciding whether to request scoped network execution or
  use signed-in dashboard controls.
- 2026-08-01T17:15:52.0738476Z: A captured fixed-category classifier returned
  only `authentication_unavailable`, confirming the historical cause rather
  than a sandbox or network denial. The recurrence is closed by selecting the
  signed-in dashboard name/type inventory; no CLI login or credential change
  is requested.
