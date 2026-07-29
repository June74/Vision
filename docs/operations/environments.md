# Vision deployment environments

## Plain-language guide

Vision has three separate places where it can run:

- **Local** is a developer's computer. It uses `VISION_ENV=local` and never receives hosted-service credentials.
- **Preview** is an isolated Worker named `vision-preview`. It can only be started manually after the preview GitHub environment grants its own token. It is for reviewing a candidate, not for real personal data.
- **Production** is the live Worker. A person must manually start its workflow, type `DEPLOY VISION PRODUCTION` exactly, and approve the protected GitHub `production` environment after the same commit passes verification.

A normal branch update never releases Vision. Pull requests run checks only. The preview job also stays inert when its approved preview token is absent.

## Technical contract

| Environment | GitHub trigger and environment | Cloudflare target | Verification before deployment |
| --- | --- | --- | --- |
| Local | Developer command; no GitHub environment | Local Vite/Worker runtime | `pnpm check` and relevant local tests |
| Preview | Explicit `workflow_dispatch`; `preview` | `vision-preview` with `VISION_ENV=preview` | `pnpm check` and `pnpm test:e2e` |
| Production | Explicit `workflow_dispatch`, exact confirmation, and external `production` protection | Default `vision` Worker with `VISION_ENV=production` | `verify` resolves the checked-out commit SHA, then completes `pnpm check` and `pnpm test:e2e`; deploy checks out that exact SHA |

The workflows use frozen lockfile installation, least-privilege `contents: read` permissions, and environment-specific concurrency groups. Preview and production have different GitHub environments, Worker names, and API-token secrets. Each verifies a checked-out ref, exports its immutable commit SHA, and deploys only that SHA. No account identifier, token value, or deployment URL is committed here.

## Preview acceptance candidates

The committed local, preview, and production configurations always contain
only the 15-minute maintenance schedule and daily recovery schedule. Temporary
acceptance work is available only from an explicit preview dispatch:

1. Start `observe` for one exact evidence family and the reviewed ref. The
   observer is non-mutating, has a separate concurrency group, tails for at
   most 16 minutes, and the job is bounded at 18 minutes.
2. Dispatch exactly one mutation operation for the same immutable ref:
   `deploy_foundation`, `deploy_ai`, or `deploy_fault` plus one of the six
   closed fault scenarios. Candidate deployment fails unless the matching
   observer run is still in progress at that SHA.
3. The workflow builds and validates the normal artifact first, then generates
   a separate `dist/vision/wrangler.acceptance.json`. The candidate adds only
   one exact selector and the one-minute schedule; it never edits the normal
   artifact and never uses command-line variable overrides.
4. The AI evidence candidate and `ai_stopped` fault perform a read-only
   Gateway-limit verification. Only the dedicated AI evidence operation may
   compose that successful same-run boolean into the generated attestation
   binding.
5. After evidence, dispatch `rollback` separately. Rollback deploys the
   pre-validated normal artifact, then verifies healthy runtime, exactly two
   schedules, and absence of the temporary selector, attestation, and
   one-minute schedule before any provider cleanup or later candidate.

Observer and mutation jobs use different concurrency groups, so starting an
observer cannot cancel a deployment and a deployment cannot cancel the
observer it must prove. This is an operator-controlled cross-run sequence; the
workflow does not claim an automatic rollback across runs.

## External production prerequisites

This repository commit does **not** configure GitHub environment protection. Before a release is permitted, repository administrators must configure the `production` environment with required reviewers, no bypass for the release path, and an approved deployment-branch policy. The typed confirmation in the workflow is an additional repository-level check, not a substitute for those external controls.

## Operator checklist

1. Review a pull request after its required `Check` job passes.
2. Manually dispatch the preview workflow only when a preview review is needed;
   for a temporary candidate, complete the observer, candidate, and separate
   rollback sequence above. Confirm the rendered `Vision` shell,
   `/api/health`, two normal schedules, and no temporary bindings before
   requesting a release.
3. Before a production release, confirm that required reviewers, no-bypass behavior, and the deployment-branch policy have been configured externally. Manually dispatch the workflow with the reviewed ref and type `DEPLOY VISION PRODUCTION` exactly. Do not bypass the external environment approval.
