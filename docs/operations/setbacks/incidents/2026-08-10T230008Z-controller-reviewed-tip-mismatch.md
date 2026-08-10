# SB-20260810-230008-controller-reviewed-tip-mismatch

- Incident ID: `SB-20260810-230008-controller-reviewed-tip-mismatch`
- First observed: `2026-08-10T23:00:08Z`
- Last observed: `2026-08-10T23:00:08Z`
- Status: `contained`
- Phase/task: Phase B monitored candidate acceptance
- Environment: local controller, remote `codex/phase-b-foundation` branch
- Version/commit: candidate `c1911f82`; branch tip `aa36b6c7`

## Symptom

The bounded controller returned `failed_closed` immediately before observer or
candidate dispatch. Its reviewed-commit input was `c1911f82`, while the
immutable remote branch tip is the later docs-only commit `aa36b6c7`.

## Impact

No GitHub workflow, Wrangler upload, deployment, rollback, traffic change,
secret, key, schedule, binding, database, or calendar action occurred.

## Evidence

- Candidate worktree is detached at `c1911f82`.
- Remote `codex/phase-b-foundation` tip is `aa36b6c7`.
- The non-documentation diff between the two commits is empty.
- The controller's exact-tip guard is designed to reject this attribution
  mismatch before dispatch.

## Cause classification

- **Confirmed cause:** The reviewed commit in the fresh input did not equal the
  immutable remote branch tip required by the controller.
- **Rejected hypotheses:** The candidate build, preview configuration, or
  Cloudflare deployment path was not exercised and did not fail.
- **Known exclusions:** No provider mutation or external workflow dispatch.

## Correction and prevention

Keep the immutable commit identity explicit. Either review and rebuild the
current branch tip `aa36b6c7` (whose source/config tree is unchanged from
`c1911f82`) or restore the branch tip to the exact uploaded commit without
silently rewriting history. Do not bypass the controller's tip guard.

## Owner and next diagnostic step

- Owner: Vision Phase B release operator.
- Next step: choose the reviewed-commit attribution path before retrying the
  live acceptance.
