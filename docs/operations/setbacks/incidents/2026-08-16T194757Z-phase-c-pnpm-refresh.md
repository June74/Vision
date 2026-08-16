# SB-20260816-194757-phase-c-pnpm-refresh: pnpm verification refresh blocked

- **Status:** contained
- **First observed:** 2026-08-16T19:47:57.5066229Z
- **Last observed:** 2026-08-16T19:47:57.5066229Z
- **Phase/task:** Phase C one-off create execution verification
- **Environment:** Windows PowerShell, isolated Phase C worktree
- **Version/commit:** Phase C worktree before adapter commit; no source commit was made by the failed command

## Symptom

The repository's `pnpm typecheck` script did not start TypeScript. The local
pnpm wrapper attempted registry metadata access and then attempted a
non-interactive modules-directory refresh, which aborted because no TTY was
available.

## Impact

The package-manager verification command did not run. The refresh reported an
abort before removing the existing modules directory; the local dependency
directory remained present. No lockfile, source, provider, deployment,
credential, database, or key state changed.

## Cause classification

- **Confirmed cause:** The pnpm wrapper performed its dependency-state check in
  a restricted-network, non-interactive worktree instead of using the already
  available local binaries directly.
- **Known exclusions:** Focused Vitest had already run successfully, and the
  failed wrapper did not execute the TypeScript compiler or a provider request.

## Correction and prevention

- **Correction:** Use the checked-in local Windows binaries for the bounded
  TypeScript checks, and do not request a dependency refresh during this
  verification pass.
- **Prevention:** Inspect package scripts first; use `node_modules/.bin/*.cmd`
  for local checks when pnpm attempts network or module refresh work.

## Verification and related work

The local `node_modules` directory was confirmed present after the abort. The
direct compiler checks remain the required verification boundary for this
worktree.
