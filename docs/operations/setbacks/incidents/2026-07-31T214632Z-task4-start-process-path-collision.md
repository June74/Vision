# SB-20260731-214632-task4-start-process-path-collision: Captured Task 4 test did not start because Path keys collided

- **Status:** closed
- **First observed:** 2026-07-31T21:46:32.8280569Z
- **Last observed:** 2026-08-06T21:44:49.2591140Z
- **Phase/task:** Phase B Task 4 v1 AI repair and OAuth reconnect Task 5 immutable-candidate CI
- **Environment:** Local Windows PowerShell test runner
- **Version/commit:** candidate `c1911f8`

## Symptom

`Start-Process` rejected the inherited environment because both `Path` and
`PATH` were present in its case-insensitive dictionary. pnpm and Vitest never
started, so the command produced no test evidence.

## Impact

The first RED attempt was invalid and discarded. No source, provider, network,
database, deployment, staging state, or commit changed.

## Cause classification

- **Confirmed cause:** Windows PowerShell normalized two inherited environment
  keys to the same case-insensitive key inside `Start-Process`.
- **Known exclusions:** This was not an application test failure.

## Correction and prevention

- **Correction:** Use a direct captured `cmd.exe /d /c` test invocation.
- **Prevention:** Do not use `Start-Process` for captured pnpm commands in this
  environment.
- **Owner:** Codex.
- **Next diagnostic step:** None.

## Recurrence history

- 2026-07-31T21:46:32.8280569Z: Contained before any test result was claimed.
- 2026-08-02T22:09:56.9255830Z: Recurred when the immutable-candidate CI
  capture reused `Start-Process`. The CI process and result file did not start,
  but redirect setup created two ignored zero-byte log files. An immediate
  progress update incorrectly said no log file was created; a fresh filesystem
  check corrected that claim before work resumed. No tracked artifact,
  provider, credential, key, database, calendar, or deployment state changed.
  The zero-byte logs remain as safe evidence, and the retry uses direct
  invocation rather than `Start-Process`.
- 2026-08-02T22:25:40.4919578Z: Closed after a direct `cmd.exe` capture probe
  and the full candidate CI both completed with native exit zero. The latter
  wrote a durable result and preserved exact HEAD and tracked cleanliness.
- 2026-08-06T21:43:55.8185968Z: Recurred when the monitored deployment
  launcher used `Start-Process`; Windows rejected the inherited `Path`/`PATH`
  collision before the no-provider launcher probe could start. No provider or
  project state changed. The next correction uses direct process APIs.
- 2026-08-06T21:44:49.2591140Z: Closed after the direct
  `System.Diagnostics.Process` launcher ran the no-provider behavioral harness
  with exit zero, the expected marker, and empty stderr.
