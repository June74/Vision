# SB-20260731-014432-task3-isolated-worktree-offline-install-cache-miss: Task 3 isolated worktree offline install missed a package archive

- **Status:** closed
- **First observed:** 2026-07-31T01:44:32.928658Z
- **Last observed:** 2026-07-31T04:00:50.7687353Z
- **Phase/task:** Phase B Task 3 isolated controller integration verification
- **Environment:** Isolated Windows Git worktree using pnpm offline mode
- **Version/commit:** 2bfbc23f13c44e60b01bbffcecc9748d322765b5

## Symptom

The frozen offline dependency install stopped because one required package archive was not present in the local package store.

## Impact

The controller repair worktree could not run tests yet; no source, provider, live, or protected state changed.

## Reproduction conditions

Run the frozen offline install in the new controller-hardening worktree when
the shared pnpm store lacks one lockfile-selected archive.

## Safe evidence

The package manager returned the cache-miss category. The public package
location that accompanied it is tracked separately as a prohibited-output
recurrence and is not reproduced here.

## Attempts and outcomes

- The offline frozen install was attempted once and stopped at the missing
  archive.
- No online retry was attempted.

## Cause classification

- **Confirmed cause:** The local content-addressed package store is incomplete
  for this lockfile.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No source edit, package-version change, network
  request, provider action, protected value, or live request occurred.

## Correction and prevention

- **Correction:** Reuse the verified dependency tree already installed in the
  primary Phase B worktree through a local filesystem junction after checking
  both exact paths.
- **Prevention:** For short-lived isolated worktrees at the same lockfile and
  commit range, prefer a verified local dependency-tree junction before
  attempting offline installation.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The incomplete dependency directory was preserved, a local junction to the
verified primary dependency tree was created, and the focused controller suite
passed 32 tests in one file without an install or network request.

## Recurrence history

- 2026-07-31T01:44:32.928658Z: First observed.
- 2026-07-31T01:50:37.2528640Z: Closed after the local dependency junction
  supported a 32-test focused controller pass.
- 2026-07-31T03:49:42.3108772Z: Recurred when a package-manager typecheck
  attempted to reconcile the isolated linked dependency tree, performed a
  registry metadata check, and aborted its noninteractive directory repair.
  No package, source, provider, or external state changed. Verification
  switches to the existing local compiler binaries.
- 2026-07-31T04:00:50.7687353Z: Closed after direct linked local source and
  test compilers completed with zero diagnostics and no install or network
  retry.
