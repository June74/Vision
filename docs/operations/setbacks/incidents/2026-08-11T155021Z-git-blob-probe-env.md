# SB-20260811-155021-git-blob-probe-env

- Incident ID: `SB-20260811-155021-git-blob-probe-env`
- First observed: `2026-08-11T15:50:21Z`
- Last observed: `2026-08-11T15:50:21Z`
- Status: `contained`
- Phase/task: Phase B evidence-ledger formatting verification
- Environment: Windows PowerShell, Phase B linked worktree
- Version/commit: `7d75341`

## Symptom

A bounded `Start-Process` probe intended to read the previous Git blob's raw
line endings failed before process start because the PowerShell environment
contained duplicate case-insensitive `Path`/`PATH` keys.

## Impact

The probe produced no evidence and no repository, provider, database, secret,
key, calendar, or deployment state changed.

## Cause classification

- **Confirmed cause:** PowerShell's `Start-Process` environment construction
  rejected duplicate path-key entries.
- **Rejected hypotheses:** Git itself was not reached and no blob was changed.

## Correction and prevention

Use the already verified working-tree convention and a direct Git read with a
bounded native fallback when raw blob bytes are needed; do not enumerate or
rebuild the process environment for this check.

## Next step

Verify the normalized evidence file using Git's whitespace-aware diff and the
repository's normal documentation checks.

## Verification

The failed probe created no usable output and left the worktree unchanged.
