# Setback SB-20260801-004913-pnpm-capture-native-command-decoration

- **Status:** contained
- **Detected:** 2026-08-01T00:49:13.6609802Z
- **Scope:** Phase B Gate 0 bounded command-output capture

## What happened

PowerShell wrapped pnpm's script-banner line in a `NativeCommandError` record
when combined output was captured with `2>&1`. The underlying typecheck, docs,
security, and unit commands each returned exit code zero; the unit rerun passed
101 files and 1,693 tests, with one intentional skip in each count.

## Impact

The captured display was noisy but the process exit codes and test summaries
were unambiguous. No repository or external state changed because of the
decoration.

## Cause classification

- **Confirmed cause:** Windows PowerShell represents native stderr records as
  `NativeCommandError` objects when streams are merged.
- **Rejected hypothesis:** A failed pnpm command; every affected command's
  authoritative exit code was zero.

## Correction and prevention

- **Correction:** Treat `$LASTEXITCODE` plus the bounded test summary as the
  gate authority.
- **Prevention:** Do not classify PowerShell's merged-stream decoration as a
  process failure without a nonzero native exit code.
- **Owner:** Codex.
- **Next diagnostic step:** None while contained.

## Recurrence history

- 2026-08-01T00:51:00.0000000Z: Recurred on both preview and production
  deployment-configuration checks. Each command's native exit was zero; the
  production validator also printed its explicit valid-configuration result.
- 2026-08-01T01:00:39.9071460Z: Recurred on the post-ledger documentation
  check. Its native exit was zero, so documentation coverage remained green.
