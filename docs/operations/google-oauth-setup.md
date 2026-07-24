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

## Revocation and cleanup

After acceptance, revoke the disposable account's Google grant, delete the disposable secondary Vision calendar, delete preview data according to the approved retention process, and rotate/revoke preview credentials if exposure is suspected. Confirm the preview account is removed from the test-user list when the pilot ends.
