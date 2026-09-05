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
| `callback_authorization_recovery_conflict` | The recovery call returned exactly `conflict`; session creation was refused by the existing guard. The observer was absent, the reason was `unclassified`/unknown/malformed, or this is local/production. It does not identify the rejected predicate. Existing audit category `authorization_recovery_failed` is preserved. |
| `callback_session_rotation_failed` | Revoking the previously presented session failed. |
| `callback_session_create_failed` | Session creation or cookie issuance failed. |
| `unclassified` | Failure outside a tagged operation. Do not infer a provider or database cause. |

The following additional categories appear only on preview, in the existing header, page, and safe
log field, and only after recovery returns exactly `conflict`. The callback observer receives only an
authored reason; no row, input, timestamp, exception, or other metadata crosses that boundary. Local
and production do not pass an observer and keep the generic conflict log stage as well as identical
failure bodies and headers. The logger still validates `diagnosticStage` with `z.enum`.

| Category | What it proves in the callback-time locked snapshot | What it does not prove |
| --- | --- | --- |
| `callback_recovery_token_missing` | No token row exists for this recovery owner. | Why it is absent, or whether another owner's row exists. |
| `callback_recovery_token_subject_mismatch` | The owner token subject differs from the verified callback subject. | Either subject's value or which operation changed it. |
| `callback_recovery_token_version_mismatch` | The owner token version differs from the authoritative version returned by persistence. | Either version, or the cause of the difference. |
| `callback_recovery_token_timestamp_mismatch` | The locked token timestamp differs from the exact persisted timestamp supplied to recovery. | Either timestamp, a specific precision/driver fault, or a concurrent writer's identity. |
| `callback_recovery_setup_subject_mismatch` | The locked setup subject differs from the exact token subject. | The subjects, or why setup differs. |
| `callback_recovery_connection_missing` | No connection exists in the existing locked recovery relation. | Why it is absent or the state of unrelated connections. |
| `callback_recovery_connection_subject_mismatch` | The locked connection subject differs from the locked setup subject. | Which identity is correct or who changed it. |
| `callback_recovery_connection_summary_mismatch` | The stored connection summary does not equal the required `Vision` literal. | The summary value or Google's current calendar metadata. |
| `callback_recovery_connection_role_mismatch` | The stored connection role does not equal the required `owner` literal. | The stored role value or current Google permissions. |
| `callback_recovery_checkpoint_missing` | No checkpoint matches the existing locked connection/provider relation. | Why it is absent or the state of other calendars. |
| `callback_recovery_maintenance_missing` | No maintenance row matches the existing locked checkpoint relation. | Why it is absent or the state of unrelated rows. |
| `callback_recovery_maintenance_setup_version_mismatch` | The maintenance connection version differs from the setup version. | Either version or the operation responsible. |
| `callback_recovery_maintenance_checkpoint_version_mismatch` | Neither exact checkpoint-version equality nor the existing connected/unmarked lag allowance admits the relation. | Either version, or that all lag is invalid; the existing lag allowance is unchanged. |
| `callback_recovery_topology_unclassified` | The existing topology relation rejects recovery, but no earlier named topology check explains it. | A specific missing row, rejected predicate, or root cause. |
| `callback_recovery_connected_marker_present` | A connected checkpoint still has at least one credential-failure marker field. | Which field/value is present or why the marker remains. |
| `callback_recovery_authorization_marker_version_mismatch` | For a disconnected authorization checkpoint, marker version differs from checkpoint version, including null. | Either version or why they differ. |
| `callback_recovery_authorization_marker_category_mismatch` | For a disconnected authorization checkpoint, marker category is not `authorization`, including null. | The category value or its source. |
| `callback_recovery_authorization_marker_timestamp_mismatch` | For a disconnected authorization checkpoint, marker time differs from checkpoint update time, including null. | Either timestamp or a specific clock/driver fault. |
| `callback_recovery_authorization_token_not_newer` | For a disconnected authorization checkpoint, the token timestamp is not strictly newer than the marker time. | Either timestamp or proof that a newer Google grant was issued. |

These rows are in first-mismatch precedence order: token checks, then topology checks, then marker
checks. Comparisons are null-safe. Only the first failing check is reported, not an exhaustive list;
later checks may also fail. `unclassified` and malformed values map to the existing generic conflict
stage, never a new `callback_recovery_unclassified` stage or arbitrary text. The reason is computed
from existing materialized locked relations and the existing decision in the same recovery SQL
statement. No extra query is made and no reason is persisted. Separate SQL snapshots and synthetic
driver probes cannot establish which predicate failed during a live callback.

An observer notification does not decide admission: final `recovered`/`not_needed` outcomes still
continue token-save/recovery/session-rotation/session-creation ordering; throws and invalid outcomes
still report `callback_authorization_recovery_failed`. A conflict creates no session/cookie and does
not revoke an old session. Every recovery failure keeps audit category `authorization_recovery_failed`.

Other existing closed-set stages may still be logged outside preview; only their response header/page
are preview-gated. Google's benign `profile` identity scopes remain accepted;
missing required or broader application scopes still fail closed. A scope failure is a hypothesis
until the live category confirms it. Never share callback URLs, codes, state, or secrets.

The conflict distinction was added after the connected-lag repair. Earlier
deployments used `callback_authorization_recovery_failed` for both outcomes;
check the deployed commit before interpreting a previously recorded category.
The later predicate diagnostic adds only a final SQL diagnostic projection and an optional observer;
it does not change recovery locks, admission predicates, decision precedence, updates, atomicity, or
session admission. Successful deployment is not sign-in or Phase C acceptance.

Deploy the integrated Phase C branch, not the historical PR #3 tree or the old `main` tree.
The Phase C preview workflow builds with `CLOUDFLARE_ENV=preview`, validates
`dist/vision/wrangler.json`, then deploys that generated configuration. Preserve the real queue
consumer, scheduled handler, schedules, and preview resource bindings. Do not add a no-op queue
handler or remove the existing consumer to make a stale build deploy.

Do not remove the diagnostic before the owner confirms preview sign-in. After that confirmation,
remove together: the optional repository observer/type/literal reason set, final `conflict_reason`
SQL projection, HTTP reason mapper and new stages, route observer and production adapter forwarding,
diagnostic tests and mirrored references, plus the existing temporary OAuth diagnostic module/header/
page instrumentation and `diagnosticStage` in `SafeLogEventSchema`. Preserve every actual authentication
and recovery rule, outcome contract, lock, predicate, update, atomicity assertion, and session-ordering
test. Run the normal checks after removal; removing instrumentation is not an auth-rule repair.

## Revocation and cleanup

After acceptance, revoke the disposable account's Google grant, delete the disposable secondary Vision calendar, delete preview data according to the approved retention process, and rotate/revoke preview credentials if exposure is suspected. Confirm the preview account is removed from the test-user list when the pilot ends.
