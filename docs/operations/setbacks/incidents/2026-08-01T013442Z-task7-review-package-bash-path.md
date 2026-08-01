# Setback SB-20260801-013442-task7-review-package-bash-path

- **Status:** closed
- **Detected:** 2026-08-01T01:34:42.2827824Z
- **Scope:** Phase B Task 7 fresh exact-tip review package

## What happened

The provided `review-package` script was launched with Git's `bin/bash.exe`,
whose process PATH did not expose `dirname`. The script exited 127 before it
wrote the expected package. A fallback recursive search for the optional
setback helper then crossed broken package-manager links beneath
`node_modules` and emitted unrelated directory-read errors.

## Impact

The fresh review dispatch was delayed. The expected review package does not
exist, and no repository, index, HEAD, remote, provider, deployment, or key
state changed.

## Cause classification

- **Confirmed cause:** The selected Git Bash launcher did not provide the
  script's required core utilities on PATH; the helper search was broader than
  the repository-owned source paths.
- **Rejected hypothesis:** A partial review package was created; the exact
  target path is absent.

## Correction and prevention

- **Correction:** Retry through Git's full `usr/bin/bash.exe` environment and
  use exact paths instead of repository-wide recursive searches.
- **Prevention:** Prefer the `usr/bin` launcher for skill-provided Bash scripts
  on this host, and exclude dependency trees from file discovery.
- **Owner:** Codex.
- **Verification:** The Windows-native fallback created one ignored package for
  the exact authoring-to-candidate range. It contains the commit list, stat,
  and full-context diff, spans 55,054 lines, and leaves tracked Git status
  unchanged apart from this incident record.

## Recurrence history

- 2026-08-01T01:36:00.0000000Z: Recurred with Git's `usr/bin/bash.exe` because
  the inherited Windows PATH still omitted Git core utilities. The script again
  exited 127 before writing the exact package path. The next step inspects
  command lookup directly and sets only the required Git utility PATH.
- 2026-08-01T01:38:00.0000000Z: A login-shell retry exposed `dirname`, but the
  companion workspace helper then treated the Windows worktree path with spaces
  as an inadmissible directory and failed before package creation. After three
  unsuccessful launcher variants, the Bash helper is classified incompatible
  with this host/worktree. The skill's documented Windows fallback will create
  the equivalent ignored package from native Git commit-list, stat, and
  full-context diff output.
