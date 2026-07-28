# SB-20260726-191644-pnpm-exec-local-binary-resolution: pnpm exec did not resolve local binary

- **Status:** closed
- **First observed:** 2026-07-26T19:16:44.091309Z
- **Last observed:** 2026-07-28T14:18:00Z
- **Phase/task:** CI secret-handoff architecture audit
- **Environment:** Local Windows PowerShell
- **Version/commit:** `7d2f9f6`; reviewed candidate `0f08fc1`

## Symptom

The Windows shell invocation of pnpm exec did not resolve an installed local executable, so the targeted test process never started.

## Impact

No code or provider state changed; RED verification was delayed until the local binary path was used directly.

## Reproduction conditions

Invoke a local executable through `pnpm exec` in this shell.

## Safe evidence

The package runner reported that the installed executable was not recognized.

## Attempts and outcomes

- The test process did not start through `pnpm exec`.
- The local executable path ran the intended suite successfully.

## Cause classification

- **Confirmed cause:** This PowerShell/package-runner combination did not
  resolve the local command wrapper.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** Dependencies were installed and the executable existed.

## Correction and prevention

- **Correction:** Called the repository-local `.cmd` executable directly.
- **Prevention:** Use the local Windows command wrapper for ad hoc tool
  invocations in this worktree.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The latest repository-local wrapper retry ran the exact five Task 2 focused
files with 59 passing tests.

## Recurrence history

- 2026-07-26T19:16:44.091309Z: First observed.
- 2026-07-26T20:34:39.6525898Z: Recurred during focused local migration
  validation; no test started and the repository-local Windows wrapper was
  used for the retry.
- 2026-07-26T22:57:22Z: Recurred during normal backup-schedule restoration.
  No test started; the retry uses `node_modules/.bin/vitest.cmd` directly.
- 2026-07-27T00:19:11Z: Recurred during the AI Gateway identifier regression
  test. No test process started; the retry uses the repository-local Windows
  wrapper directly.
- 2026-07-27T13:14:09Z: Recurred during the restore tail-correction RED run.
  No test process started; the retry uses the repository-local Windows wrapper
  directly.
- 2026-07-27T19:41:30Z: Recurred during the missed routing-test correction.
  No test process started; the retry uses
  `node_modules/.bin/vitest.cmd` directly.
- 2026-07-28T01:20:44.6624354Z: Recurred during Task 3 candidate
  reconfirmation. Inspection confirmed that the local executable and its
  target both existed; the failure was pnpm command resolution, not a stale
  installation. The repository-local wrapper ran the exact five focused files
  with 59 passing tests. No provider mutation occurred.
- 2026-07-28T14:18:00Z: Recurred during a read-only CI capability audit when
  `pnpm exec` did not resolve the installed Wrangler binary. The local wrapper
  remained present, and no provider or repository mutation was attempted.

The repository-local wrapper then ran the focused suite with 8 passing tests.
