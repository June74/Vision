# Setback SB-20260801-004913-pnpm-capture-native-command-decoration

- **Status:** closed
- **Detected:** 2026-08-01T00:49:13.6609802Z
- **Last observed:** 2026-08-02T22:25:40.4919578Z
- **Scope:** Phase B Gate 0 through OAuth reconnect Task 5 immutable-candidate CI capture

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
  process failure without a nonzero native exit code. Do not combine
  `$ErrorActionPreference = 'Stop'` with `2>&1` around a native Git command
  that can emit a benign warning; leave streams separate and judge the native
  process by `$LASTEXITCODE`.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Recurrence history

- 2026-08-01T00:51:00.0000000Z: Recurred on both preview and production
  deployment-configuration checks. Each command's native exit was zero; the
  production validator also printed its explicit valid-configuration result.
- 2026-08-01T01:00:39.9071460Z: Recurred on the post-ledger documentation
  check. Its native exit was zero, so documentation coverage remained green.
- 2026-08-02T01:58:30.3564670Z: Recurred during the explicitly approved
  reviewed-candidate publication command. Git emitted known line-ending
  warnings while staging; strict PowerShell error handling stopped the wrapper
  before the exit-code check. Read-only reconciliation then proved all 93
  reviewed paths were staged, no unstaged or untracked path remained, local
  `HEAD` still matched its tracking tip, and no commit or push had occurred.
- 2026-08-02T18:08:26.2233354Z: Recurred during the preview-scoped local build
  because strict PowerShell error handling promoted pnpm's ordinary stderr
  script banner before `$LASTEXITCODE` could be checked. The wrapper stopped
  before preview validation or deployment. The retry leaves native streams
  separate, discards them independently, and judges only native exit codes.
- 2026-08-02T22:16:25.2821973Z: Recurred after roughly five minutes of the
  immutable-candidate CI run because strict error handling promoted pnpm's
  ordinary script banner from redirected stderr before the wrapper recorded
  `$LASTEXITCODE` or post-run invariants. The run is discarded as evidence;
  no verdict is inferred from its logs. The retry disables terminating error
  promotion only around the direct native invocation, keeps streams separate,
  and records the native exit plus fresh post-run Git checks.
- 2026-08-02T22:25:40.4919578Z: Closed after direct `cmd.exe` redirection
  preserved native stdout/stderr and exit status without PowerShell stream
  decoration. Full CI exited zero, its durable result matched the exact
  candidate, and post-run tracked-state checks returned clean.
