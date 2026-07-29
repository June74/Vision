# SB-20260729-022734-skill-root-expansion-mistake: Incorrect local skill-root expansion interrupted guidance load

- **Status:** closed
- **First observed:** 2026-07-29T02:27:34.985989Z
- **Last observed:** 2026-07-29T18:12:20Z
- **Phase/task:** Acceptance instrumentation Task 4 final re-review setup
- **Environment:** Windows PowerShell, isolated phase-b-foundation worktree
- **Version/commit:** ecd74074fe223d4e9d185e8c92dd033eb26678a4

## Symptom

The initial guidance load addressed the setback-logger skill through the wrong configured skill root, producing a path-not-found error.

## Impact

No product code or private data changed; setup paused until the configured root was re-read and the skill was loaded successfully.

## Reproduction conditions

Manual path expansion was used instead of copying the configured skill-root
mapping. The follow-up read also assumed the incident filename instead of
copying the exact path emitted in `INDEX.md`.

## Safe evidence

- The configured catalog maps `r0` to the local `.codex/skills` root.
- The incident index links the generated file by timestamp and slug rather than
  by the stable incident ID.
- Reading the skill and then the exact indexed incident path both succeeded.

## Attempts and outcomes

- Initial read used the wrong local skill root and failed with path-not-found.
- Corrected the skill path from the configured root; the complete skill loaded.
- First incident read guessed the generated filename and failed with
  path-not-found.
- Copied the exact `INDEX.md` link target; the incident loaded successfully.

## Cause classification

- **Confirmed cause:** The operator manually reconstructed two local paths
  instead of copying the exact configured or emitted paths.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No repository product code, credentials, private data,
  or external systems were affected.

## Correction and prevention

- **Correction:** Re-read the configured skill-root mapping and the exact
  generated index entry, then loaded both files successfully.
- **Prevention:** Copy configured and tool-emitted paths verbatim; do not infer
  skill roots or generated filenames.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

- `Get-Content` completed successfully for the corrected setback-logger skill
  path.
- `Get-Content` completed successfully for the exact incident path linked from
  `docs/operations/setbacks/INDEX.md`.

## Recurrence history

- 2026-07-29T02:27:34.985989Z: First observed.
- 2026-07-29T02:30:00Z: Recurrence while reading the newly created incident;
  corrected by using the exact indexed filename.
- 2026-07-29T03:01:53Z: Recurrence while loading the final re-review skills;
  `scope-gate` was addressed through the `.codex` root instead of its configured
  `.agents` root. No repository action depended on the failed read, and copying
  the configured root loaded the complete skill successfully.
- 2026-07-29T18:12:20Z: Recurrence during Task 6 final cleanup re-review;
  `scope-gate` was again addressed through the `.codex` root instead of its
  configured `.agents` root. No production or test change preceded the failed
  read. The correction is to copy the `r1` mapping exactly before continuing.
