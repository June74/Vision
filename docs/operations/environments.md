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

1. Start `observe` by dispatching the workflow from the exact reviewed commit
   or ref in GitHub's workflow selector. The observer checks out the dispatch
   commit from `github.sha` and proves the checkout still equals that commit
   before installing dependencies or receiving provider credentials. It is
   non-mutating, has a separate concurrency group, tails one exact evidence
   family for at most 16 minutes, and the job is bounded at 18 minutes.
2. Dispatch exactly one mutation operation from that same reviewed commit:
   `deploy_foundation`, `deploy_ai`, or `deploy_fault` plus one of the six
   closed fault scenarios. Candidate deployment fails unless the currently
   deployed preview is healthy, has exactly the two normal schedules, and has
   an explicit provider binding list with no temporary binding. A missing,
   null, malformed, or failed provider response fails closed.
3. The workflow proves that one exact `preview.yml` observer run is in progress
   at the candidate's verified commit and matches its evidence family. As the
   last two pre-deploy controls, it repeats the complete workflow-identity, SHA,
   liveness, and family proof and then revalidates the generated candidate's
   expiry against the recovery window. A finished observer or stale candidate
   cannot authorize deployment.
4. The workflow builds and validates the normal artifact first, then generates
   a separate `dist/vision/wrangler.acceptance.json`. The candidate adds only
   one exact selector and the one-minute schedule; it never edits the normal
   artifact and never uses command-line variable overrides.
5. The AI evidence candidate and `ai_stopped` fault perform a read-only
   Gateway-limit verification. Only the dedicated AI evidence operation may
   compose that successful same-run boolean into the generated attestation
   binding.
6. After evidence, dispatch `rollback` separately with the latest candidate run
   reference and `authenticated_reads_gate=not_verified`. Rollback first proves
   that reference owns the newest candidate-intent artifact, deploys the
   pre-validated normal artifact, then verifies healthy runtime, exactly two
   schedules, and an explicit valid binding list without the temporary
   selector or attestation. It uploads a value-free restored-normal proof bound
   to the candidate reference and reviewed normal commit.
7. Only after rollback succeeds, use the existing signed-in Vision session for
   post-restore authenticated diagnostics and calendar reads. Dispatch
   `close_rollback` with that candidate reference, the successful rollback run,
   and `authenticated_reads_gate=verified`. The closure job proves the rollback
   run and restored-normal artifact, repeats the provider-state verification,
   and writes a closure bound to the commit and both provider checks.
8. A later candidate must supply the newest candidate reference and the
   successful closure run. `verify_cleanup` enforces the same closed state
   before any provider cleanup. The first candidate is the only baseline case:
   the artifact query must prove that no candidate intent exists.

Observer and mutation jobs use different concurrency groups, so starting an
observer cannot cancel a deployment and a deployment cannot cancel the
observer it must prove. Mutation runs serialize without cancelling an
in-progress rollback or closure. Candidate deployment is bounded to 30 minutes,
rollback and closure to 15 minutes each, and cleanup verification to 10 minutes.
This is an operator-controlled cross-run sequence; the workflow does not claim
an automatic rollback across runs.

For a local preview artifact check in PowerShell, select the preview Vite
environment explicitly before building:

```powershell
$env:CLOUDFLARE_ENV = "preview"
pnpm.cmd build
pnpm.cmd deploy:check:preview
```

Without `CLOUDFLARE_ENV=preview`, the default build is not the preview artifact
that `deploy:check:preview` is intended to validate.

## Authenticated read gate for preview mutation

Before selecting a candidate-deploy operation, an operator uses the existing
signed-in Vision session to complete authenticated diagnostics and calendar
reads against the current normal preview. Confirm that the
diagnostics view loads and that the calendar view returns the expected
owner-scoped result without recording response bodies in workflow output.

The `authenticated_reads_gate=verified` choice is a manual operator
attestation. It does not create or require a new authentication secret, and
the workflow does not pretend to perform browser-session reads itself.
Candidate deployment requires the pre-candidate attestation, but rollback
requires `not_verified` so a pre-deploy assertion cannot close the lifecycle.
After the normal Worker and provider state are restored, `close_rollback`
requires a new `verified` attestation for the post-restore authenticated
diagnostics and calendar reads. Non-mutating `none`, `observe`, cleanup
verification, and rollback require `not_verified`.

Temporary candidate activation is also blocked during the fail-closed UTC
window around the normal daily recovery schedule. Candidate preparation stamps
an exact expiry no more than 30 minutes after activation. The first check proves
that this complete maximum lifetime cannot overlap the protected window; the
second check reads the generated candidate and is immediately adjacent to
deployment. Every temporary scheduled execution rechecks the candidate expiry
and protected interval against wall-clock execution time before resolving
temporary dependencies, so an expired, delayed, overlong, malformed, or
overlap-capable candidate fails closed. The normal purge window, permanent
daily recovery, and post-acceptance cleanup behavior are unchanged.

## External production prerequisites

This repository commit does **not** configure GitHub environment protection. Before a release is permitted, repository administrators must configure the `production` environment with required reviewers, no bypass for the release path, and an approved deployment-branch policy. The typed confirmation in the workflow is an additional repository-level check, not a substitute for those external controls.

## Operator checklist

1. Review a pull request after its required `Check` job passes.
2. Manually dispatch the preview workflow only when a preview review is needed;
   choose the exact reviewed commit or ref in GitHub's workflow selector. For a
   temporary candidate, complete the observer, candidate, and separate rollback
   sequence above. Confirm the rendered `Vision` shell,
   `/api/health`, two normal schedules, and no temporary bindings before
   requesting a release.
3. Before a production release, confirm that required reviewers, no-bypass behavior, and the deployment-branch policy have been configured externally. Manually dispatch the workflow with the reviewed ref and type `DEPLOY VISION PRODUCTION` exactly. Do not bypass the external environment approval.

## Permanent post-acceptance closure order

1. reviewed Task 9 cleanup is deployed;
2. normal health, signed-in reads, exactly two schedules, and temporary absence are proved;
3. disposable branch deletion and absence are proved;
4. replay marker is deleted last.

Provider deletion is manual. No workflow receives a deletion operation. If
branch deletion or its absence proof is uncertain, retain the replay marker and
stop. Backup key version 1 is retained and is not rotated.
