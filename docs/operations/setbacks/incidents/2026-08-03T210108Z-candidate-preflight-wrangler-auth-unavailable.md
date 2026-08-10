# SB-20260803-210108-candidate-preflight-wrangler-auth-unavailable: Candidate deployment preflight could not use saved Wrangler authentication

- **Status:** closed
- **First observed:** 2026-08-03T21:01:08.934097Z
- **Last observed:** 2026-08-03T21:25:23.6971358Z
- **Phase/task:** Phase B monitored candidate deployment
- **Environment:** Windows PowerShell 5.1; restricted candidate launcher followed by an approved outside-sandbox read-only Wrangler probe using normal saved authentication and no `XDG_CONFIG_HOME` override
- **Version/commit:** `8793f88a36718446c012e207aabd82dfd2ef056e`

## Symptom

The single authorized deploy_candidate controller run stopped before candidate dispatch with wrangler_authentication_failed even though no XDG_CONFIG_HOME override was set.

## Impact

No candidate deployment, rollback, schedule change, or other provider mutation occurred; the one-run authorization was consumed and a new deployment run is not permitted until the launcher/authentication boundary is diagnosed and separately reauthorized.

## Reproduction conditions

Launch the one-run `deploy_candidate` controller from the restricted sandbox.
Its first read-only deployment-list preflight cannot use the normal saved
Wrangler login even though the same command can use that login outside the
restricted sandbox.

## Safe evidence

The authorized controller run reported
`candidate_preconditions_passed=false`, `candidate_accepted=false`,
`failure_category=wrangler_authentication_failed`, `rolled_back=false`, and
`rollback_verified=false`. A later outside-sandbox read-only probe discarded
the provider response and reported only `ExitZero=true`,
`OutputPresent=true`, `JsonDecodable=true`, and
`AuthenticationUsable=true`.

## Attempts and outcomes

1. Process inspection through CIM was denied before controller launch.
2. A `Start-Process` launcher failed locally because its environment collection
   contained a key collision; no controller started.
3. An alternate launcher API could not carry the required environment
   collection; no controller started.
4. The fallback restricted launcher started exactly one authorized controller
   run, which failed closed at its read-only Wrangler authentication preflight.
5. A separately approved outside-sandbox deployment-list probe, with provider
   output discarded, proved the normal saved Wrangler authentication is usable.

## Cause classification

- **Confirmed cause:** The successful controller launcher ran inside the
  restricted sandbox, where Wrangler could not access the user's normal saved
  login. The login itself is healthy outside that boundary.
- **Hypotheses:** None remaining for the preflight failure.
- **Rejected hypotheses:** The Wrangler login expired; the Cloudflare account
  or deployment-list API was unavailable; an `XDG_CONFIG_HOME` override hid the
  login.
- **Known exclusions:** No candidate deployment, rollback, schedule change,
  secret change, or other provider mutation occurred.

## Correction and prevention

- **Correction:** Run the controller outside the restricted sandbox with normal
  saved Wrangler authentication and no configuration-directory override.
- **Prevention:** Before consuming a one-run deployment authorization, verify
  read-only authentication in the same execution boundary and require the
  operator brief to name that boundary explicitly.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None for the authentication boundary; the later
  provider upload failure is tracked separately.

## Verification and related work

The outside-sandbox read-only probe exited successfully, returned output, and
decoded the discarded response as JSON. This verifies the corrected
authentication boundary without changing provider state. Candidate deployment
acceptance remains a separate pending operation.

## Recurrence history

- 2026-08-03T21:01:08.934097Z: First observed.
- 2026-08-03T21:03:29.8935477Z: Saved authentication verified outside the
  sandbox; launcher-boundary cause confirmed and contained.
- 2026-08-03T21:25:23.6971358Z: Closed after the outside-sandbox controller
  passed its Wrangler authentication and full candidate preconditions. The
  later upload failure is a separate incident.
