# SB-20260731-214632-task4-start-process-path-collision: Captured Task 4 test did not start because Path keys collided

- **Status:** contained
- **First observed:** 2026-07-31T21:46:32.8280569Z
- **Last observed:** 2026-07-31T21:46:32.8280569Z
- **Phase/task:** Phase B Task 4 v1 AI compatibility repair
- **Environment:** Local Windows PowerShell test runner
- **Version/commit:** 2cf0ff1 plus uncommitted Task 4 implementation

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
- **Next diagnostic step:** Run the isolated RED test through `cmd.exe`.

## Recurrence history

- 2026-07-31T21:46:32.8280569Z: Contained before any test result was claimed.
