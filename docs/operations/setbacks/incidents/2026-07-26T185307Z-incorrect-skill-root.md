# SB-20260726-185307-incorrect-skill-root: Incorrect local skill root used

- **Status:** closed
- **First observed:** 2026-07-26T18:53:07.263429Z
- **Last observed:** 2026-07-26T18:53:07.263429Z
- **Phase/task:** Phase B release operations
- **Environment:** Local Codex workspace
- **Version/commit:** `codex/phase-b-foundation`

## Symptom

A read-only skill lookup targeted the wrong configured root and failed before project work resumed.

## Impact

No project or provider state changed; the release workflow paused briefly while the correct path was resolved.

## Reproduction conditions

Read `scope-gate/SKILL.md` using the `r0` skill root even though the available-skills
catalog maps that skill to `r1`.

## Safe evidence

The configured skill catalog maps `scope-gate` to
`C:\Users\2006i\.agents\skills`, and the retry from that root succeeded.

## Attempts and outcomes

- The first read from the `r0` root failed with a file-not-found error.
- The retry from the catalog-declared `r1` root succeeded.

## Cause classification

- **Confirmed cause:** The lookup ignored the skill-root mapping in the active
  catalog and assumed every personal skill lived under `r0`.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No repository, deployment, provider, or secret state was
  changed.

## Correction and prevention

- **Correction:** Resolved the `r1` root from the catalog and completed the read.
- **Prevention:** Expand each skill's declared root alias before accessing its
  files; do not infer roots from neighboring skills.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The correct skill file was read successfully in the same run.

## Recurrence history

- 2026-07-26T18:53:07.263429Z: First observed.
