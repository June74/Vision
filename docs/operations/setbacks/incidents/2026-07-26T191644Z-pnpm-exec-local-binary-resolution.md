# SB-20260726-191644-pnpm-exec-local-binary-resolution: pnpm exec did not resolve local binary

- **Status:** closed
- **First observed:** 2026-07-26T19:16:44.091309Z
- **Last observed:** 2026-07-26T19:16:44.091309Z
- **Phase/task:** Phase B deployment fix tests
- **Environment:** Local Windows PowerShell
- **Version/commit:** `codex/phase-b-foundation`

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

The focused test suite subsequently ran and passed 4/4.

## Recurrence history

- 2026-07-26T19:16:44.091309Z: First observed.
