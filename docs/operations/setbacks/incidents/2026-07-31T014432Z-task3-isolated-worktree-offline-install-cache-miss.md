# SB-20260731-014432-task3-isolated-worktree-offline-install-cache-miss: Task 3 isolated worktree offline install missed a package archive

- **Status:** contained
- **First observed:** 2026-07-31T01:44:32.928658Z
- **Last observed:** 2026-08-03T00:09:39.7937338Z
- **Phase/task:** Phase B Task 3 isolated controller verification and OAuth reconnect Task 5 artifact installation
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
- 2026-08-02T22:03:26.0257671Z: Recurred in the short immutable candidate
  because one lockfile-pinned archive was absent from the local pnpm store.
  The frozen offline install stopped before downloading anything; no lockfile,
  source, Git metadata, provider, credential, key, or deployment state
  changed. Any partial dependency-directory residue is inspected before the
  ordinary frozen retry.
- 2026-08-02T22:06:58.2441604Z: The rollback artifact's silent frozen offline
  install also exited one after the candidate install completed, but silent
  mode exposed no category. The result remains contained and unaccepted until
  one captured diagnostic classifies the failure without printing package
  locations or private values.
- 2026-08-02T22:07:30.8719392Z: One captured diagnostic confirmed the rollback
  failure category was the same missing offline archive class. Raw output was
  retained only in memory and not displayed or saved. The correction is an
  ordinary frozen-lockfile install with no version or lockfile change.
- 2026-08-02T22:08:29.4487470Z: Closed after ordinary frozen-lockfile installs
  exited zero in candidate and rollback. A fresh post-install check returned
  true for both exact detached commits, tracked cleanliness, five-file byte
  parity, sub-260-character Vitest metadata paths, and required package import
  mappings.
- 2026-08-03T00:09:39.7937338Z: Recurred after the approved rollback artifact
  was recreated for the corrected deployment attempt. Its silent offline
  frozen install exited one without a network request or lockfile, source,
  Git, provider, credential, or key change. The previously classified
  correction remains one ordinary frozen-lockfile install followed by exact
  artifact and lockfile immutability checks.
