# SB-20260730-004035-fresh-candidate-lifetime-check: Fresh candidate failed the adjacent lifetime check

- **Status:** closed
- **First observed:** 2026-07-30T00:40:35.8133508Z
- **Last observed:** 2026-07-30T00:43:39.1517844Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 3
- **Environment:** Local Windows PowerShell worktree
- **Version/commit:** Uncommitted wave-3 fix based on `dc3a517`

## Symptom

The corrected fixed command line generated the first preview acceptance
candidate, but the immediately adjacent local lifetime validator returned a
nonzero exit before the shape and pricing checks ran.

## Impact

The eight-candidate verification remains incomplete. The exact generated
candidate path was removed in the same `finally` boundary. No source,
provider, deployment, database, object, calendar, or private state changed.

## Reproduction conditions and safe evidence

- The generator exited zero and created the exclusive candidate output path.
- The value-free lifetime validator returned nonzero.
- Exact cleanup confirmed the candidate output path was absent afterward.

## Attempts and outcomes

- The earlier inline launcher failed before generation.
- A fixed `cmd.exe` command preserved both required empty scalars and generated
  the first artifact.
- The adjacent lifetime check then failed and stopped the loop.

## Cause classification

- **Confirmed cause:** The local verifier used a non-workflow absolute
  candidate-path invocation. The same freshly generated artifact passed when
  the exact workflow-relative path was used.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Candidate generation still cannot preserve empty
  arguments; the corrected generator exited zero and created the artifact.
  The generated deadline was also canonical, positive, and within the maximum
  lifetime when the relative-path retry passed.
- **Known exclusions:** No external system or production path was invoked.

## Correction and prevention

- **Correction:** Regenerated the candidate, retained only bounded structural
  and timestamp facts, and invoked the validator with the workflow's exact
  repository-relative path.
- **Prevention:** Keep generation, bounded inspection, validation, and exact
  cleanup in one guarded local boundary.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The bounded diagnostic proved a canonical positive deadline within the
maximum lifetime. The relative-path retry exited zero. The complete corrected
loop generated and validated all eight candidate selectors, attested their
artifact pricing shape, and removed every candidate output.

## Recurrence history

- 2026-07-30T00:40:35.8133508Z: First observed and contained.
- 2026-07-30T00:43:39.1517844Z: The exact workflow-relative retry and all
  eight corrected candidate checks passed; no candidate artifact remained.
