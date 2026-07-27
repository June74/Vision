# SB-20260727-013704-pnpm-update-metadata-fetch-warning: pnpm update metadata fetch warned

- **Status:** closed
- **First observed:** 2026-07-27T01:37:04Z
- **Last observed:** 2026-07-27T21:10:21Z
- **Phase/task:** Phase B restore Task 3 verification
- **Environment:** Local restricted-network worktree
- **Version/commit:** `50569e6`

## Symptom

The frozen dependency install completed successfully but pnpm's optional
version-update metadata request could not reach the public registry.

## Impact

Dependencies were already current, the command exited zero, and the lockfile
did not change. The optional warning made the output non-pristine.

## Cause classification

- **Confirmed cause:** The package-manager update notifier attempted a network
  metadata fetch in a restricted environment.
- **Known exclusions:** Package installation and lockfile verification did not
  fail.

## Correction and prevention

- **Correction:** Disable pnpm's update notifier for the remaining verification
  commands.
- **Prevention:** Set the package-manager update-notifier control in restricted
  clean-room runs so optional metadata does not pollute release evidence.

## Verification and related work

The frozen install exited zero and reported the workspace already up to date.

## Recurrence history

- 2026-07-27T01:37:04Z: First observed and contained.
- 2026-07-27T04:48:42Z: Recurred during the Task 3 frozen-install gate. The
  command exited zero, reported dependencies current, and the before/after
  lockfile digests matched. The clean rerun disables only the optional update
  notifier before the gate sequence continues.
- 2026-07-27T04:49:11Z: The generic notifier environment flag was a rejected
  mitigation because pnpm repeated the non-fatal metadata warning. The command
  again exited zero with an unchanged lockfile. The next bounded rerun uses
  pnpm's configuration-specific environment key.
- 2026-07-27T21:10:21Z: The listener-first execution baseline repeated the
  optional registry metadata warning. The frozen install reported the
  workspace already current and exited zero; no lockfile changed.
