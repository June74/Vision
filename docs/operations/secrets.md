# Vision secret handling

## Plain-language rules

Secrets are passwords for services. Keep them in the matching GitHub environment or Cloudflare secret store, never in source code, logs, issue text, client bundles, or preview artifacts. A preview token can deploy only the isolated preview Worker; it must not be interchangeable with the live token.

Never expose `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY`, `DATABASE_URL`, `KEY_ENCRYPTION_KEY`, or any other key-encryption secret through a Vite client-prefixed variable. In particular, none may use a name beginning with `VITE_`. Values with that prefix are bundled for browsers and must be treated as public.

## Secret inventory and ownership

| Secret name | Owner | Allowed environment | Rotation trigger | Allowed in preview |
| --- | --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN_PREVIEW` | Platform owner | GitHub `preview` only | 90 days, maintainer departure, suspected disclosure, or scope change | Yes |
| `CLOUDFLARE_API_TOKEN_PRODUCTION` | Platform owner plus production approver | GitHub `production` only | 90 days, approver change, suspected disclosure, or scope change | No |
| `GOOGLE_CLIENT_SECRET` | Identity integration owner | Server-side production only when Google sign-in is introduced | OAuth client rotation, suspected disclosure, or integration-owner change | No |
| `OPENAI_API_KEY` | AI integration owner | Server-side approved environments only when AI is introduced | Provider key rotation, budget/security incident, or owner change | No |
| `DATABASE_URL` | Data owner | Server-side approved environments only when database access is introduced | Credential rotation, incident, schema-host move, or owner change | No |
| `KEY_ENCRYPTION_KEY` and replacement key-encryption secrets | Security owner | Server-side production only unless a separately managed non-live key is approved | Key ceremony, suspected disclosure, cryptographic policy change, or owner change | No |

No application data-service secret is currently configured in these workflows. The two Cloudflare tokens are named only as GitHub secret references; their values, account identifiers, scopes, and Cloudflare resource details are intentionally absent from the repository.

## Technical controls

- Bind a secret to the narrowest GitHub environment and require review for `production`.
- Use a dedicated preview token with permission limited to the isolated preview Worker. Do not reuse a live token, even temporarily. If it is absent, the manually requested preview workflow writes a summary explaining the missing token and fails before deployment.
- Pass deployment tokens only through the action step environment. Do not use `VITE_*`, build arguments, checked-in `.env` files, or diagnostic output.
- Change a token before its old value is revoked, update the environment secret, run a manually approved validation, then revoke the old value and record the rotation.
- If a secret may have been exposed, revoke it immediately, inspect action logs and service access, and create a replacement under the same environment boundary.
