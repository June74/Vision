# SB-20260727-014937-verification-command-discovery-mistakes: Verification commands were guessed or searched too broadly

- **Status:** closed
- **First observed:** 2026-07-27T01:47:00Z
- **Last observed:** 2026-07-27T01:49:37Z
- **Phase/task:** Phase B fresh verification handoff
- **Environment:** Local worktree
- **Version/commit:** `50569e6`

## Symptom

The documentation check was first invoked with the reversed script name
`check:docs`, the setback helper was assumed to exist under `scripts/`, and a
recursive search entered dependencies and encountered a missing transient
directory.

## Impact

Verification handoff was delayed. No source, provider, credential, key, or
deployment state changed, and no private value was exposed.

## Reproduction conditions and safe evidence

- `package.json` defines `docs:check`, not `check:docs`.
- The repository does not contain `scripts/new_setback.py`.
- An unbounded recursive file search entered `node_modules`.

## Cause classification

- **Confirmed cause:** Commands and helper locations were assumed before
  inspecting the repository, and the fallback search was not bounded to
  repository-owned paths.
- **Hypotheses:** None.
- **Rejected hypotheses:** The documentation validator itself did not fail; it
  had not yet been invoked with its actual repository script name.
- **Known exclusions:** No repository mutation occurred before this incident
  record.

## Attempts and outcomes

1. `check:docs` failed because the script name does not exist.
2. The documented setback helper path failed because the helper is absent.
3. The recursive helper search produced a dependency traversal error.

## Correction and prevention

- **Correction:** Read `package.json`, use `docs:check`, and create this incident
  through the repository's established Markdown format.
- **Prevention:** Discover package scripts before invoking them; check a
  documented helper with a direct path test; exclude dependency directories
  from repository searches.
- **Owner:** Codex.
- **Next diagnostic step:** None.

## Verification and related work

At 2026-07-27T01:50Z, the repository's `docs:check` script and
`git diff --check` both passed.
