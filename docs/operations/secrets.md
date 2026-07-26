# Vision secret handling

## Plain-language rules

Secrets are passwords for services. Keep them in the matching GitHub environment or Cloudflare secret store, never in source code, logs, issue text, client bundles, or preview artifacts. Use a dedicated preview token scoped to the approved Cloudflare account and minimum Workers permissions; never reuse it for production.

Never expose `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY`, `DATABASE_URL`, `KEY_ENCRYPTION_KEY`, or any other key-encryption secret through a Vite client-prefixed variable. In particular, none may use a name beginning with `VITE_`. Values with that prefix are bundled for browsers and must be treated as public.

## Secret inventory and ownership

| Secret name | Owner | Allowed environment | Rotation trigger | Allowed in preview |
| --- | --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN_PREVIEW` | Platform owner | GitHub `preview` only | 90 days, maintainer departure, suspected disclosure, or scope change | Yes |
| `CLOUDFLARE_API_TOKEN_PRODUCTION` | Platform owner plus production approver | GitHub `production` only | 90 days, approver change, suspected disclosure, or scope change | No |
| `GOOGLE_CLIENT_SECRET` | Identity integration owner | Cloudflare Worker runtime, with a separate value per environment | OAuth client rotation, suspected disclosure, or integration-owner change | Yes, with a preview-only value |
| `GOOGLE_ALLOWED_SUB` and `GOOGLE_ALLOWED_EMAIL` | Identity integration owner | Cloudflare Worker runtime, limited to the approved user for that environment | Approved-user change or suspected disclosure | Yes, with a preview-only identity |
| `OPENAI_API_KEY` | AI integration owner | Server-side approved environments only after explicit AI acceptance approval | Provider key rotation, budget/security incident, or owner change | Yes, with a preview-only value after explicit approval |
| `DATABASE_URL` | Data owner | Cloudflare Worker runtime, using a least-privileged role dedicated to the environment | Credential rotation, incident, schema-host move, or owner change | Yes, with a preview-only role and database |
| `KEY_ENCRYPTION_KEY` and replacement key-encryption secrets | Security owner | Cloudflare Worker runtime, with an independent key per environment | Key ceremony, suspected disclosure, cryptographic policy change, or owner change | Yes, with a preview-only key |

No application data-service secret is configured in these workflows. Preview deployment uses `CLOUDFLARE_API_TOKEN_PREVIEW` and `CLOUDFLARE_ACCOUNT_ID_PREVIEW` from the protected GitHub `preview` environment; their values, scopes, and Cloudflare resource details are intentionally absent from the repository. Application secrets remain in the Cloudflare Worker runtime as separately managed, non-live preview values. Non-secret runtime configuration such as `GOOGLE_CLIENT_ID` and `VISION_USER_TIME_ZONE` follows the same environment separation.

## Technical controls

- Bind a secret to the narrowest GitHub environment and require review for `production`.
- Use a dedicated preview token scoped to the approved Cloudflare account and minimum Workers permissions. Do not reuse a production token, even temporarily. The manually requested preview workflow writes a safe summary and fails before deployment when either preview deployment entry is unavailable.
- Pass deployment tokens only through the action step environment. Do not use `VITE_*`, build arguments, checked-in `.env` files, or diagnostic output.
- Change a token before its old value is revoked, update the environment secret, run a manually approved validation, then revoke the old value and record the rotation.
- If a secret may have been exposed, revoke it immediately, inspect action logs and service access, and create a replacement under the same environment boundary.
