# SB-20260728-030600-cloudflare-secret-list-authentication-unavailable: CLI secret inventory lacked authentication

- **Status:** closed
- **First observed:** 2026-07-28T03:06:00Z
- **Last observed:** 2026-07-28T03:06:00Z
- **Phase/task:** Preview database role probe Task 2 Step 2
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
