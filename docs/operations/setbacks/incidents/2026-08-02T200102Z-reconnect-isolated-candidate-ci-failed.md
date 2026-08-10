# SB-20260802-200102-reconnect-isolated-candidate-ci-failed: Detached reconnect candidate release gate failed

- **Status:** contained
- **First observed:** 2026-08-02T20:01:02.936498Z
- **Last observed:** 2026-08-02T20:10:57.7489950Z
- **Phase/task:** Phase B OAuth reconnect recovery Task 5 isolated-candidate verification
- **Environment:** Detached local candidate worktree after offline frozen pnpm install
- **Version/commit:** `c1911f82c0fb274e3d50d20c3cbe82ba2abceb51`

## Symptom

The exact detached candidate full CI command exited nonzero after the offline install.

## Impact

Deployment is stopped until the isolated-only failure is diagnosed, corrected if necessary, and the exact gate passes.

## Reproduction conditions

Create the exact detached candidate under the ignored evidence directory, run
the offline frozen dependency installation, and start `pnpm.cmd run ci`.

## Safe evidence

The durable result records the exact candidate, exit code one, and
`ci_passed=false`. Safe filtered output places the failure in the unit-test
launcher: Vitest reported that its private package import mapping was absent.
The candidate installation lacks Vitest's package metadata at the resolved
package directory even though its executable chunk was reached.

## Attempts and outcomes

- The exact candidate and offline installation checks passed before CI.
- CI stopped at the unit-test launcher; no later gate was counted.
- The first metadata comparison correctly found the candidate package metadata
  absent but then attempted to read/hash that missing path, producing harmless
  follow-on local errors. Those outputs are excluded from release evidence.
- A forced offline reinstall requested pnpm's short virtual-store option and
  exited zero, but the existing installation retained its original default
  link. The validator then attempted to resolve the absent requested store and
  emitted two harmless path warnings; the visible package mapping check itself
  passed only through the short top-level link and did not prove the resolved
  store moved. The attempt is rejected as a repair.
- Fresh short worktrees installed successfully, exposed Vitest metadata at a
  223-character path, and passed the focused launcher check. Their complete
  candidate gate then reached the unit suite and failed only three
  byte-sensitive checks: two workflow LF literals and one exact migration blob
  hash. The remaining 1,753 assertions passed with six intentional skips.

## Cause classification

- **Confirmed cause:** Two independent Windows artifact-layout effects were
  proved. The original deep pnpm path reached exactly 260 characters at
  Vitest's metadata. After shortening the path, Git's Windows checkout
  normalization wrote committed LF workflow/migration blobs as CRLF, causing
  the repository's deliberate literal and byte-hash checks to fail.
- **Hypotheses:** None remaining for this failure stage.
- **Rejected hypotheses:** No Vision assertion, TypeScript diagnostic, database
  case, Worker test, browser test, or provider request caused this run's exit.
- **Known exclusions:** The candidate commit stayed exact; the same commit's
  complete primary-worktree gate passed immediately before isolation.

## Correction and prevention

- **Correction:** Retain the original failed deep artifact for evidence. Remove
  and recreate only the generated short candidate and rollback worktrees using
  command-scoped `core.autocrlf=false` and `core.eol=lf`, then prove the
  byte-sensitive working files hash to their exact committed blobs before the
  offline installs and complete candidate rerun.
- **Prevention:** Detached artifact verification must validate critical package
  metadata after offline install before counting that installation as usable.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** After explicit owner approval for the rejected local
  Git action, recreate and byte-verify the two short LF artifacts.

## Verification and related work

The candidate remains retained, unchanged, and undeployed. Deployment is
stopped while the isolated install is repaired.

The package inspection proved one Vitest entry, a top-level pnpm symbolic link,
and an exact 260-character metadata path. The first comparison correctly found
the direct path unavailable but then tried to parse and hash it; that diagnostic
mistake caused only local follow-on errors and did not alter the candidate.

## Recurrence history

- 2026-08-02T20:01:02.936498Z: First observed.
- 2026-08-02T20:03:33.6917933Z: Confirmed as a Windows path-length failure and
  selected pnpm's supported short virtual-store option for the contained retry.
- 2026-08-02T20:05:07.8936296Z: Rejected the in-place short-store retry because
  the existing pnpm link did not move. Proved fresh ignored paths absent,
  ignored, and safely below the failing Windows path boundary.
- 2026-08-02T20:10:57.7489950Z: The short candidate passed the original package
  boundary and reached the unit suite; three byte-sensitive checks proved CRLF
  checkout normalization. Deployment remained stopped.
- 2026-08-02T20:15:40.4735054Z: The approval system rejected LF artifact
  recreation before Git executed because of an internal request-format error.
  Work pauses for explicit owner approval; deployment remains stopped.
