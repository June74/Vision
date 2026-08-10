# Setback SB-20260801-013442-task7-review-package-bash-path

- **Status:** closed
- **Detected:** 2026-08-01T01:34:42.2827824Z
- **Last observed:** 2026-08-02T20:21:42.1996326Z
- **Scope:** Phase B Task 7 review package through OAuth reconnect Task 5 remaining-plan audit

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
- 2026-08-02T17:08:32.6408667Z: Recurred when the Task 1 brief helper used
  Git's minimal `bin/bash.exe`, whose PATH omitted `awk`. The helper exited
  before writing content and left only a zero-byte ignored target. Read-only
  lookup confirmed `awk` under `usr/bin`; the explicit-output retry uses that
  launcher and avoids the incompatible workspace helper.
- 2026-08-02T17:09:23.0911116Z: The direct `usr/bin/bash.exe` retry inherited
  the same Windows PATH and again could not resolve `awk`; the zero-byte
  ignored target remained the only effect. The final launcher attempt
  explicitly prepends `/usr/bin`, as the earlier incident requires.
- 2026-08-02T17:10:14.9347364Z: Closed after the explicit `/usr/bin` PATH
  produced the exact Task 1 brief with 941 lines and the expected heading.
- 2026-08-02T20:20:49.0134535Z: Recurred when Task 8-10 brief generation used
  the same helper in the Windows worktree path with spaces. Even with explicit
  `/usr/bin`, its workspace-directory handling split the path and failed before
  writing any brief. No repository, candidate, provider, database, credential,
  or deployment state changed. The contained fallback is bounded direct plan
  reading; this recurrence remains open until that read succeeds.
- 2026-08-02T20:21:42.1996326Z: Closed after bounded direct reads captured the
  complete authoritative Task 8, Task 9, and Task 10 requirements without
  creating a malformed brief or changing repository/provider state.
