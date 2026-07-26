# SB-20260726-190208-assumed-wrangler-config-path: Conventional Wrangler config path was assumed

- **Status:** closed
- **First observed:** 2026-07-26T19:02:08.702614Z
- **Last observed:** 2026-07-26T19:02:08.702614Z
- **Phase/task:** Phase B release operations
- **Environment:** Local Phase B worktree
- **Version/commit:** `codex/phase-b-foundation`

## Symptom

A read-only inspection requested a root wrangler.toml file that does not exist in this repository.

## Impact

No source or provider state changed; the correct generated deployment config must be resolved from repository references.

## Reproduction conditions

Assume the conventional root filename `wrangler.toml` without first listing the
repository's matching config files.

## Safe evidence

The repository contains `wrangler.jsonc`, and the preview workflow builds
`dist/vision/wrangler.json` from it.

## Attempts and outcomes

- The conventional filename read failed.
- A root file listing resolved `wrangler.jsonc`.
- The actual file confirmed the R2, Queue, cron, budget, and preview variables.

## Cause classification

- **Confirmed cause:** The inspection inferred a standard Wrangler filename
  instead of resolving it from the repository.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** The deployment config was not missing.

## Correction and prevention

- **Correction:** Read `wrangler.jsonc` and the workflow's generated-config path.
- **Prevention:** List matching root files or follow build-script references
  before naming a configuration file.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The actual source config was found and inspected successfully.

## Recurrence history

- 2026-07-26T19:02:08.702614Z: First observed.
