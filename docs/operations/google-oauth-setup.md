# Preview Google OAuth setup

This procedure is documentation only. It does not create a Google client, Worker, database branch, secret, or calendar.

## Required approval

Before any external acceptance, the user must explicitly approve creating or configuring the preview Google OAuth client, preview Worker, preview Neon branch, and preview GitHub/Cloudflare secrets. Approval must name the disposable Google account and the preview target.

## Preview configuration record

Use a Google Cloud project dedicated to Vision preview, with an **External** consent screen in testing mode. Add only the approved disposable test account. Do not publish the app or add general users.

Register this callback path exactly on the approved preview origin:

`https://vision-preview.<approved-cloudflare-subdomain>.workers.dev/api/auth/google/callback`

Replace `<approved-cloudflare-subdomain>` only after approval; do not guess an account subdomain or commit the resulting URI until the external configuration is approved. The path `/api/auth/google/callback` is exact.

Approve only `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/calendar.calendarlist.readonly`. Do not request event-write scopes.

## Preview deployment configuration

Configure only these deployment entries in the protected GitHub `preview` environment. Record values nowhere in this repository:

- `CLOUDFLARE_API_TOKEN_PREVIEW`
- `CLOUDFLARE_ACCOUNT_ID_PREVIEW`

The Account ID is not a credential by itself, but this workflow stores it alongside the token so both deployment inputs share the same protected environment boundary.

Configure the application secrets directly in the Cloudflare Worker runtime:

- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_ALLOWED_SUB`
- `GOOGLE_ALLOWED_EMAIL`
- `KEY_ENCRYPTION_KEY`
- `VISION_USER_TIME_ZONE`

Set the non-secret runtime variable `GOOGLE_REDIRECT_URI` to
`https://vision-preview.june74.workers.dev/api/auth/google/callback`.

The allowlisted subject and email must identify only the approved disposable account. The database user must be the least-privileged `vision_app` role. No name may use a `VITE_` prefix.

## Temporary preview sign-in diagnostic

Preview deployments (`VISION_ENV=preview`) name the OAuth stage that failed. Nothing else changes:
statuses, redirects, cookies, and the local and production response bodies are byte-identical to
before. The value is always one constant from the closed set in `src/server/auth/diagnostics.ts` — it
can never carry an authorization code, state, PKCE verifier, nonce, cookie, Google token, claim,
email, subject, or secret.

Read it in any of three places:

- The response header `X-Vision-Auth-Diagnostic` on the failing request (browser devtools, Network
  tab, or `curl -i`).
- One extra line on the failure page itself: `Diagnostic stage: <category>`.
- The `diagnosticStage` field of the safe log event in `wrangler tail`.

What each category means:

| Category | Failing step |
| --- | --- |
| `start_dependencies_unavailable` | Authentication dependency initialization failed: binding validation, encryption setup, or database access. Google never opens. |
| `start_admission_key_failed` | The server could not derive the admission key. |
| `start_protocol_values_failed` | Server-generated state, nonce, or verifier failed validation. |
| `start_transaction_write_failed` | State could not be written to Neon. |
| `start_transaction_rejected` | Admission limit reached (the safe 429), not a fault. |
| `start_refresh_lookup_failed` | The stored-refresh-token lookup failed. |
| `start_authorization_url_failed` | PKCE challenge or authorization URL construction failed. |
| `callback_dependencies_unavailable` | Authentication dependency initialization failed on the callback. |
| `callback_query_invalid` | Google returned an `error` parameter, or a missing/duplicate/oversized `code` or `state`. |
| `callback_state_not_found` | State was absent, consumed, or expired, OR the transaction lookup/decryption failed. This category alone does not distinguish these causes. |
| `callback_code_exchange_failed` | Google rejected the token exchange — the usual cause is a client secret or `redirect_uri` that does not match the OAuth client. |
| `callback_scope_rejected` | Google granted a scope set other than the exact V1 set. Because the authorization request sends `include_granted_scopes=true`, an older broader consent on the same account is returned alongside the requested scopes and is rejected here. Remove the account's existing Vision grant at <https://myaccount.google.com/permissions> and sign in again. |
| `callback_id_token_invalid` | ID-token signature or JWKS verification failed. |
| `callback_claims_invalid` | Issuer, audience, `email_verified`, expiry, or nonce did not match. |
| `callback_account_not_allowed` | The signed-in account is not `GOOGLE_ALLOWED_EMAIL` / `GOOGLE_ALLOWED_SUB` (the 403 page). |
| `callback_token_persist_failed` | Token encryption or the Neon token write failed. |
| `callback_authorization_recovery_failed` | Phase C reconnect recovery threw or returned an invalid outcome; no session is issued. This does not identify a precise SQL error. Existing audit category `authorization_recovery_failed` is preserved. |
| `callback_authorization_recovery_conflict` | The recovery call returned exactly `conflict`; session creation was refused by the existing guard. This does not identify which token/topology/marker check conflicted. Existing audit category `authorization_recovery_failed` is preserved. |
| `callback_session_rotation_failed` | Revoking the previously presented session failed. |
| `callback_session_create_failed` | Session creation or cookie issuance failed. |
| `unclassified` | Failure outside a tagged operation. Do not infer a provider or database cause. |

Only the response header/page are preview-gated; safe structured logs may contain a closed-set
stage in other environments too. Google's benign `profile` identity scopes remain accepted;
missing required or broader application scopes still fail closed. A scope failure is a hypothesis
until the live category confirms it. Never share callback URLs, codes, state, or secrets.

The conflict distinction was added after the connected-lag repair. Earlier
deployments used `callback_authorization_recovery_failed` for both outcomes;
check the deployed commit before interpreting a previously recorded category.
This diagnostic-only change does not alter recovery SQL or session admission.

Deploy the integrated Phase C branch, not the historical PR #3 tree or the old `main` tree.
The Phase C preview workflow builds with `CLOUDFLARE_ENV=preview`, validates
`dist/vision/wrangler.json`, then deploys that generated configuration. Preserve the real queue
consumer, scheduled handler, schedules, and preview resource bindings. Do not add a no-op queue
handler or remove the existing consumer to make a stale build deploy.

Remove this diagnostic once preview sign-in is confirmed working: delete
`src/server/auth/diagnostics.ts` and its references, and drop `diagnosticStage` from
`SafeLogEventSchema`.

## Revocation and cleanup

After acceptance, revoke the disposable account's Google grant, delete the disposable secondary Vision calendar, delete preview data according to the approved retention process, and rotate/revoke preview credentials if exposure is suspected. Confirm the preview account is removed from the test-user list when the pilot ends.
