# SB-20260807-200728-diagnosis-search-tooling-fallback: Read-only diagnosis tooling fallback

- **Status:** closed
- **First observed:** 2026-08-07T20:06:50Z
- **Last observed:** 2026-08-10T18:58:59.105Z
- **Phase/task:** Phase B Cloudflare-side deployment diagnosis
- **Environment:** Windows PowerShell, linked Phase B worktree
- **Version/commit:** Current reviewed Phase B checkout; no tracked implementation change

## Symptom

The initial read-only repository search could not start because the local
`rg.exe` binary returned an access-denied error. A follow-up timestamp probe
used the unsupported `Get-Date -AsUTC` parameter on this PowerShell version.
An overly broad recursive fallback then traversed stale linked-worktree
`node_modules` paths and emitted path-read warnings.
An initial attempt to append the next diagnostic evidence used a malformed
patch and was rejected before writing any file.
An additional PowerShell result-pipeline wrapper had an empty-pipe parser
error before execution.
The follow-up comparison assumed every Git revision label was at least eight
characters and hit a formatting exception for the literal `HEAD`; the safe
pinned-commit comparison had already completed.
Its first boolean formatter also compared JSON lines including punctuation,
which produced false negatives even though the safe names were present.

## Impact

No provider request, deployment, configuration change, secret access, or
tracked implementation change occurred. Diagnosis was briefly delayed.

## Resolution

PowerShell's built-in text-search path was selected as the safe fallback, and
UTC timestamps are now produced with `(Get-Date).ToUniversalTime()`. The
remaining checks are restricted to explicitly named files and directories,
excluding recursive dependency trees.
The malformed patch was corrected and verified with the normal documentation
check.
The loop was rewritten to collect results explicitly before formatting them.
Revision labels are now shortened only when their length permits it.
Binding checks use parsed names rather than punctuation-sensitive line matches.

## Prevention

Prefer the repository's PowerShell fallback when `rg.exe` cannot execute,
restrict fallback searches to named files, and use the version-compatible UTC
conversion rather than assuming newer PowerShell parameter support.
Validate patch structure before submission and confirm the target file after
each documentation update.
Use an explicit result array for PowerShell loops instead of piping directly
from a closing `foreach` block.
Handle symbolic revision labels separately from full commit hashes.
Do not use raw formatted JSON lines as semantic equality values.

## Recurrence history

- 2026-08-07T20:06:50Z: First observed during read-only deployment diagnosis.
- 2026-08-10T01:44:12Z: Recurred while locating existing Cloudflare support
  notes. `rg.exe` again failed before searching; bounded `Select-String`
  immediately found the matching incident and no repository or provider state
  changed.
- 2026-08-10T18:24:37.8885585Z: The PowerShell `Get-Date -AsUTC` probe
  recurred while investigating a dashboard status discrepancy. It failed
  before any repository or provider action; the version-compatible
  `(Get-Date).ToUniversalTime()` form remains the required fallback.
- 2026-08-10T18:58:59.105Z: The bounded `rg.exe` search failed with Windows
  access denied before searching while locating the final retry invocation.
  The named-file `Select-String` fallback completed; no repository or provider
  state changed.
- 2026-08-10T23:39:00Z: A multi-root `rg` invocation was constructed with
  PowerShell path expressions instead of separate search roots, so the search
  stopped with an invalid-path error before reading files. No repository or
  provider state changed; the named-root search form is the required fallback.
- 2026-08-10T23:42:32Z: A one-line TypeScript probe used top-level `await` in
  the repository's CommonJS `tsx` evaluation mode, so it failed during
  transformation before running the read-only guard check. No repository or
  provider state changed; use an async IIFE for inline probes.
- 2026-08-11T00:18:04.153Z: A candidate deployment-check invocation was
  rejected before execution because the sandbox permission label was
  misspelled. No repository, candidate, or provider state changed; validate
  tool parameters before dispatching the command.
- 2026-08-11T00:22:21.175Z: A read-only source-inspection invocation repeated
  the same permission-label typo and was rejected before execution. No
  repository, candidate, or provider state changed; use the default read-only
  workspace access for local inspection.
- 2026-08-11T00:23:34.709Z: A local test-file read used the parent checkout
  instead of the Phase B worktree and failed before reading. No repository,
  candidate, or provider state changed; use the explicit worktree path for
  checkout-specific inspection.
- 2026-08-11T00:24:33.929Z: A focused regression command invoked `pnpm exec
  vitest` directly, but this checkout exposes the runner through its package
  script and no direct binary was available. No repository, candidate, or
  provider state changed; use the repository test script.
- 2026-08-11T00:30:27.097Z: Two documentation patches used stale surrounding
  text and were rejected before changing the incident record. No repository,
  candidate, or provider state changed; inspect the exact local context before
  applying a follow-up patch.
- 2026-08-11T00:48:51.121Z: The `rg.exe` repository-file listing was blocked by
  Windows access control before searching. The named-file PowerShell fallback
  remains the required search path; no repository or provider state changed.
- 2026-08-11T01:17:12.004Z: A redacted observer-log probe was rejected before
  execution because a PowerShell newline escape was mis-escaped in the command
  wrapper. No log, repository, candidate, or provider state was accessed.
- 2026-08-11T01:20:18.981Z: A multi-path `Get-ChildItem` search omitted the
  explicit `-Path` parameter and failed before reading. No repository,
  candidate, or provider state changed; use `Get-ChildItem -Path` with named
  roots for this fallback.
