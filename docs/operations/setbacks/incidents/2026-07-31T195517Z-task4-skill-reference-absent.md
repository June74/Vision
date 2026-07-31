# SB-20260731-195517-task4-skill-reference-absent: Optional Codex trace reference absent

- **Status:** closed
- **First observed:** 2026-07-31T19:55:17.465337Z
- **Last observed:** 2026-07-31T22:00:55.3182028Z
- **Phase/task:** Phase B Tasks 4 and 5 read-only instruction review
- **Environment:** Local Phase B worktree, Windows PowerShell
- **Version/commit:** c23e301

## Symptom

The installed trace-live-call-path skill names an optional Codex reference file that is not present in its package.

## Impact

No repository state or private data changed; review proceeds using the complete main skill checklist.

## Reproduction conditions

Reading the optional `references/codex-tools.md` path named by the installed skill fails because that file is absent from the package.

## Safe evidence

The complete main skill entrypoint was available and read. A directory check confirmed that the optional reference path is absent. No provider, environment, authentication, or database output was involved.

## Attempts and outcomes

- Attempted to read the named reference: file-not-found.
- Confirmed the main skill checklist is complete enough to trace entry points and call paths without the optional adapter note.

## Cause classification

- **Confirmed cause:** The installed skill package does not include the named optional Codex adapter reference.
- **Hypotheses:** None active.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** The Task 4 repository files are not implicated; no product behavior was exercised.

## Correction and prevention

- **Correction:** Continue with the complete main skill checklist and repository-native inspection tools.
- **Prevention:** Treat adapter references as optional and verify their presence before attempting to read them.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; incident closed.

## Verification and related work

Verified that the main skill entrypoint is readable and contains the required live-entry-point tracing checklist.

## Recurrence history

- 2026-07-31T19:55:17.465337Z: First observed.
- 2026-07-31T21:59:41.1446861Z: Recurred when the Task 5 observer lane assumed
  the `trace-live-call-path` skill used root `r0`; the catalog assigns it to
  `r1`. The lane stopped before edits and resumes from the exact catalog path.
- 2026-07-31T22:00:55.3182028Z: Recurred when the Task 5 scheduled-evidence
  lane assumed `domain-logic-contract` used root `r0`; its catalog entry uses
  `r1`. It stopped before edits and resumes only after literal alias expansion.
