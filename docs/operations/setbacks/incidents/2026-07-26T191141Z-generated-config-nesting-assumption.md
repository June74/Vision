# SB-20260726-191141-generated-config-nesting-assumption: Generated Wrangler config nesting was assumed

- **Status:** closed
- **First observed:** 2026-07-26T19:11:41.183325Z
- **Last observed:** 2026-07-26T19:11:41.183325Z
- **Phase/task:** Phase B deployment diagnostics
- **Environment:** Local generated preview artifact
- **Version/commit:** `codex/phase-b-foundation`

## Symptom

The first generated-config check inspected environment-nested properties even though the build emits the selected environment as top-level deployment configuration.

## Impact

The diagnostic initially reported all expected bindings absent and had to be rerun against the actual generated shape.

## Reproduction conditions

Read `env.preview` from the Vite-generated deployment file.

## Safe evidence

The generated file selects one target environment and exposes its deployable
settings at top level.

## Attempts and outcomes

- The first check reported false absences.
- A top-level key inspection identified the generated shape.
- The corrected check verified variables, R2, crons, and—after the fix—Queue
  bindings.

## Cause classification

- **Confirmed cause:** The diagnostic assumed the source configuration shape
  survived environment selection unchanged.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** The source configuration still uses named environments.

## Correction and prevention

- **Correction:** Read generated bindings from top-level properties.
- **Prevention:** Inspect the artifact's own key shape before asserting nested
  configuration paths.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected artifact inspection and repository validator both passed.

## Recurrence history

- 2026-07-26T19:11:41.183325Z: First observed.
