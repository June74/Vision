# SB-20260731-195503-task4-agent-skill-root-mismatch: Task 4 diagnostics review used the wrong skill root

- **Status:** closed
- **First observed:** 2026-07-31T19:55:03.9806283Z
- **Last observed:** 2026-08-01T18:32:26.9895172Z
- **Phase/task:** Phase B Task 4 diagnostics review, Task 7 continuation, and Claude Code handoff
- **Environment:** Read-only subagent skill discovery
- **Version/commit:** c23e301

## Symptom

The diagnostics review subagent first tried to read the trace-live-call-path
skill from the wrong installed-skill root. The read exited nonzero before the
subagent began project analysis.

## Impact

No project, provider, environment, network, secret, staging state, or commit
changed. The read-only review paused until the setback was recorded.

## Cause classification

- **Confirmed cause:** The skill path was reconstructed instead of expanded
  from the available-skills root mapping.
- **Hypotheses:** None remaining.
- **Known exclusions:** The corrected skill read succeeded from the mapped
  `.agents/skills` location.

## Correction and prevention

- **Correction:** Use the exact root mapping supplied with the available skill
  catalog.
- **Prevention:** Resolve every skill path from its declared root alias before
  reading it.
- **Owner:** Codex diagnostics review subagent.
- **Next diagnostic step:** None; resume the read-only review.

## Recurrence history

- 2026-07-31T19:55:03.9806283Z: Observed, corrected, and closed without project
  mutation.
- 2026-08-01T01:27:25.3898759Z: Recurred when the Phase B continuation loader
  looked for the `scope-gate` skill beneath `.codex` instead of its declared
  `.agents` root. No project command ran. The loader resumed from the catalog's
  exact root mapping.
- 2026-08-01T01:47:18.3849506Z: Recurred during Claude Code handoff preparation
  when the controller again reconstructed the `scope-gate` path beneath
  `.codex`. No project or provider action ran. The controller read the skill
  from the catalog-declared `.agents` root before resuming.
- 2026-08-01T03:09:17.5257190Z: Recurred during the final Claude Code handoff
  preparation when the controller again reconstructed the `scope-gate` path
  beneath `.codex`. No application, Git, provider, or secret state changed.
  The controller resumed only after reading the catalog-declared `.agents`
  path and the setback policy.
- 2026-08-01T18:32:26.9895172Z: Recurred after correlation-repair Task 2 had
  already completed its 68-test GREEN and scope check. The implementer
  reconstructed the completion-check skill path instead of using its declared
  catalog root, so the optional read failed and the agent stopped. No Task 2
  source, provider, network, secret, calendar, database, R2, deployment,
  workflow, backup-key, staging, or commit state changed after the failure.
