# Vision deployment environments

## Plain-language guide

Vision has three separate places where it can run:

- **Local** is a developer's computer. It uses `VISION_ENV=local` and never receives hosted-service credentials.
- **Preview** is an isolated Worker named `vision-preview`. It can only be started manually after the preview GitHub environment grants its own token. It is for reviewing a candidate, not for real personal data.
- **Production** is the live Worker. A person must manually start its workflow and approve the protected GitHub `production` environment after the same commit passes verification.

A normal branch update never releases Vision. Pull requests run checks only. The preview job also stays inert when its approved preview token is absent.

## Technical contract

| Environment | GitHub trigger and environment | Cloudflare target | Verification before deployment |
| --- | --- | --- | --- |
| Local | Developer command; no GitHub environment | Local Vite/Worker runtime | `pnpm check` and relevant local tests |
| Preview | Explicit `workflow_dispatch`; `preview` | `vision-preview` with `VISION_ENV=preview` | `pnpm check` and `pnpm test:e2e` |
| Production | Explicit `workflow_dispatch`; protected `production` | Default `vision` Worker with `VISION_ENV=production` | `verify` job must complete `pnpm check` and `pnpm test:e2e` |

The workflows use frozen lockfile installation, least-privilege `contents: read` permissions, and environment-specific concurrency groups. Preview and production have different GitHub environments, Worker names, and API-token secrets. No account identifier, token value, or deployment URL is committed here.

## Operator checklist

1. Review a pull request after its required `Check` job passes.
2. Manually dispatch the preview workflow only when a preview review is needed; confirm the rendered `Vision` shell and `/api/health` response before requesting a release.
3. Manually dispatch the production workflow with the reviewed ref. GitHub environment approval gates its deploy job after verification; do not bypass it.
