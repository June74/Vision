# SB-20260807-180008-exec-orchestration-command-variable: Local contract replay wrapper referenced the wrong JavaScript command variable

- **Status:** closed
- **First observed:** 2026-08-07T18:00:08.290641Z
- **Last observed:** 2026-08-07T18:01:09.0164554Z
- **Phase/task:** Phase B controller wait-window repair
- **Environment:** Codex JavaScript orchestration, Windows worktree
- **Version/commit:** Current reviewed Phase B checkout

## Symptom

The orchestration wrapper declared a command variable but passed an undefined cmd variable to the nested command tool, so the replay failed before any PowerShell test launched.

## Impact

No test, controller, provider, deployment, rollback, schedule, binding, secret, database, calendar, AI Gateway, or key action occurred.

## Reproduction conditions

The orchestration wrapper declared `command` but passed an undefined `cmd` variable to the nested command tool, so no PowerShell test process launched.

## Safe evidence

The corrected explicit command replay ran all 13 local controller/launcher/classifier/cleanup/native contract scripts with exit code zero. No provider action ran. Do not paste private or secret values.

## Attempts and outcomes

1. Undefined orchestration variable: failed before test launch; no state change.
2. Explicit command field: all 13 provider-free contracts passed.

## Cause classification

- **Confirmed cause:** JavaScript variable name mismatch in the orchestration wrapper.
- **Hypotheses:** None retained.
- **Rejected hypotheses:** The test scripts and controller were not at fault.
- **Known exclusions:** No deployment, rollback, schedule, binding, secret, database, calendar, AI Gateway, or key action.

## Correction and prevention

- **Correction:** Pass the explicit `cmd` field to the nested command tool and capture only scalar exit/length results.
- **Prevention:** Avoid implicit variable-name reuse in orchestration wrappers; verify the command object before launch.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Establish the smallest safe reproduction.

## Verification and related work

Verified by the corrected 13-script replay with all exit codes zero.

## Recurrence history

- 2026-08-07T18:00:08.290641Z: First observed.
- 2026-08-07T18:01:09.0164554Z: Explicit replay completed with all contracts
  passing; incident closed.
