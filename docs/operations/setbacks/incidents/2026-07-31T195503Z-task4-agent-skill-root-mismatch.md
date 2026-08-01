# SB-20260731-195503-task4-agent-skill-root-mismatch: Task 4 diagnostics review used the wrong skill root

- **Status:** closed
- **First observed:** 2026-07-31T19:55:03.9806283Z
- **Last observed:** 2026-08-01T01:47:18.3849506Z
- **Phase/task:** Phase B Task 4 diagnostics contract review
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
