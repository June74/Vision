# SB-20260807-173917-nested-tool-alias-preflight: Preflight used an unavailable nested command-tool alias

- **Status:** closed
- **First observed:** 2026-08-07T17:39:17.841750Z
- **Last observed:** 2026-08-07T17:39:31.4659311Z
- **Phase/task:** Phase B live acceptance and release closure
- **Environment:** Codex execution interface, Windows PowerShell worktree
- **Version/commit:** Current reviewed Phase B checkout

## Symptom

The first scalar preflight call referenced a nested tool name that is not available in the current execution interface, so the call failed before PowerShell ran.

## Impact

No filesystem, controller, provider, deployment, rollback, schedule, binding, secret, database, calendar, AI gateway, or key action occurred; the approved live attempt remains unstarted.

## Reproduction conditions

The first preflight call used `tools.shell_command`, which is not an available nested tool in this execution interface, so the call failed before its PowerShell body ran.

## Safe evidence

The corrected scalar preflight used the available command tool and returned: no runtime/configuration changes, stale active state present but no live process, and no XDG override. No provider action ran. Do not paste private or secret values.

## Attempts and outcomes

1. Unavailable nested tool alias: failed before command execution; no state change.
2. Available command tool: completed the bounded scalar preflight successfully.

## Cause classification

- **Confirmed cause:** The nested tool name was wrong for the current execution interface.
- **Hypotheses:** None retained.
- **Rejected hypotheses:** The worktree, stale active state, and controller were not the cause; the controller was not started.
- **Known exclusions:** No filesystem mutation beyond this incident log, and no provider, deployment, rollback, schedule, binding, secret, database, calendar, AI gateway, or key action.

## Correction and prevention

- **Correction:** Use `tools.exec_command` for nested PowerShell execution in this interface.
- **Prevention:** Confirm the available nested tool name before starting a guarded live action; keep the preflight scalar-only.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Establish the smallest safe reproduction.

## Verification and related work

Verified by the successful corrected preflight and its allowlisted scalar result.

## Recurrence history

- 2026-08-07T17:39:17.841750Z: First observed.
