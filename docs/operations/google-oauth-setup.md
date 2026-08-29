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

## Preview secret names

Configure the `_PREVIEW` names in the protected GitHub `preview` environment. When adding secrets directly to the Worker with Wrangler, use the corresponding runtime names without the `_PREVIEW` suffix. Record values nowhere in this repository:

- `CLOUDFLARE_API_TOKEN_PREVIEW`
- `DATABASE_URL_PREVIEW`
- `GOOGLE_CLIENT_ID_PREVIEW`
- `GOOGLE_CLIENT_SECRET_PREVIEW`
- `GOOGLE_ALLOWED_SUB_PREVIEW`
- `GOOGLE_ALLOWED_EMAIL_PREVIEW`
- `KEY_ENCRYPTION_KEY_PREVIEW`
- `VISION_USER_TIME_ZONE_PREVIEW`

Worker runtime names:

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
| `start_dependencies_unavailable` | Worker bindings failed to validate (`GOOGLE_*`, `DATABASE_URL`, `KEY_ENCRYPTION_KEY`) — Google never opens. |
| `start_transaction_write_failed` | State could not be written to Neon. |
| `start_transaction_rejected` | Admission limit reached (the safe 429), not a fault. |
| `start_refresh_lookup_failed` | The stored-refresh-token lookup failed. |
| `start_authorization_url_failed` | PKCE challenge or authorization URL construction failed. |
| `callback_dependencies_unavailable` | Bindings failed to validate on the callback. |
| `callback_query_invalid` | Google returned an `error` parameter, or a missing/duplicate/oversized `code` or `state`. |
| `callback_state_not_found` | State was absent, already consumed, or expired in Neon. |
| `callback_code_exchange_failed` | Google rejected the token exchange — the usual cause is a client secret or `redirect_uri` that does not match the OAuth client. |
| `callback_scope_rejected` | Google granted a scope set other than the exact V1 set. Because the authorization request sends `include_granted_scopes=true`, an older broader consent on the same account is returned alongside the requested scopes and is rejected here. Remove the account's existing Vision grant at <https://myaccount.google.com/permissions> and sign in again. |
| `callback_id_token_invalid` | ID-token signature or JWKS verification failed. |
| `callback_claims_invalid` | Issuer, audience, `email_verified`, expiry, or nonce did not match. |
| `callback_account_not_allowed` | The signed-in account is not `GOOGLE_ALLOWED_EMAIL` / `GOOGLE_ALLOWED_SUB` (the 403 page). |
| `callback_token_persist_failed` | Token encryption or the Neon token write failed. |
| `callback_session_rotation_failed` | Revoking the previously presented session failed. |
| `callback_session_create_failed` | Session creation or cookie issuance failed. |

Remove this diagnostic once preview sign-in is confirmed working: delete
`src/server/auth/diagnostics.ts` and its references, and drop `diagnosticStage` from
`SafeLogEventSchema`.

## Revocation and cleanup

After acceptance, revoke the disposable account's Google grant, delete the disposable secondary Vision calendar, delete preview data according to the approved retention process, and rotate/revoke preview credentials if exposure is suspected. Confirm the preview account is removed from the test-user list when the pilot ends.
