# Disposable calendar acceptance evidence

## Approval required before external acceptance

Do not fill this record or contact any external service until the user explicitly approves the disposable Google account, preview Worker, preview database branch, OAuth client, and preview secrets.

## Redacted evidence template

| Field | Record after approved acceptance |
| --- | --- |
| Timestamp (UTC) | `YYYY-MM-DDThh:mm:ssZ` |
| Disposable test-account alias | Alias only; no email address or subject |
| Preview commit | Full reviewed commit SHA |
| Wrong-account result | HTTP status and “no session created” only |
| Allowed-account result | HTTP status only |
| Exact confirmation result | Button disabled until exact phrase; then accepted |
| Calendar result | Secondary Vision calendar, calendar ID suffix only |
| Reload/idempotency result | One connection; no duplicate calendar |
| Event result | Zero events created by setup |
| Token inspection | No plaintext sentinel; no token value |
| Revocation and cleanup | Grant revoked, calendar cleanup result, timestamp |

Never record token values, claims, full calendar IDs, private event content, email addresses, provider error bodies, or secret values.
