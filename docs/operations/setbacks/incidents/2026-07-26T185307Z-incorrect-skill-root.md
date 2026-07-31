# SB-20260726-185307-incorrect-skill-root: Incorrect local skill root used

- **Status:** contained
- **First observed:** 2026-07-26T18:53:07.263429Z
- **Last observed:** 2026-07-31T01:30:11.4699741Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 3
- **Environment:** Local Codex workspace
- **Version/commit:** `codex/phase-b-foundation`

## Symptom

A read-only skill lookup targeted the wrong configured root and failed before project work resumed.

## Impact

No project or provider state changed; the release workflow paused briefly while the correct path was resolved.

## Reproduction conditions

Read `scope-gate/SKILL.md` and `trace-live-call-path/SKILL.md` using the `r0`
skill root even though the available-skills catalog maps both skills to `r1`.

## Safe evidence

The configured skill catalog maps both affected skills to
`C:\Users\2006i\.agents\skills`, and both corrective reads succeeded.

## Attempts and outcomes

- The first read from the `r0` root failed with a file-not-found error.
- The retry from the catalog-declared `r1` root succeeded.
- The wave-3 combined read repeated the same root-expansion mistake for
  `scope-gate` and `trace-live-call-path`; no implementation action preceded
  the failure.

## Cause classification

- **Confirmed cause:** The lookup ignored the skill-root mapping in the active
  catalog and assumed every personal skill lived under `r0`.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No repository, deployment, provider, or secret state was
  changed.

## Correction and prevention

- **Correction:** Resolved the `r1` root from the catalog and completed both
  corrective reads before repository investigation continued.
- **Prevention:** Expand each skill's declared root alias before accessing its
  files; do not infer roots from neighboring skills.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Complete the Task 3 adjudication without another
  inferred skill path, then close the recurrence.

## Verification and related work

The complete `scope-gate` and `trace-live-call-path` skill files were read
successfully from their catalog-declared `r1` paths before the live scheduled
path investigation began.

## Recurrence history

- 2026-07-26T18:53:07.263429Z: First observed.
- 2026-07-27T03:06:16.8505755Z: A read-only lookup for the
  `deliverable-acceptance-check` skill again assumed the `r0` root instead of
  expanding the catalog-declared `r1` root. The lookup failed before repository
  work, the correct catalog path was read successfully, and no project,
  provider, or private state changed.
- 2026-07-27T21:23:34.6899801Z: A combined read-only instruction lookup again
  assumed that `scope-gate` lived under `r0` instead of expanding its
  catalog-declared `r1` root. The lookup failed before provider work, the
  correct catalog path was read successfully, and no repository, provider, or
  private state changed.
- 2026-07-28T02:01:36.2087445Z: A combined read-only instruction lookup for
  four catalog-declared `r1` skills again assumed the `r0` root. The lookup
  failed before implementation work, no private data entered the output, and
  the correction was to use each skill's declared root mapping.
- 2026-07-28T20:19:03.8827218Z: A combined read-only instruction lookup
  treated the catalog-declared `r0` setback skill as an `r1` skill. The lookup
  failed before implementation work, the correct catalog path was read
  successfully, and no project, provider, or private state changed.
- 2026-07-28T20:43:57.5678432Z: A combined read-only instruction lookup
  treated the catalog-declared `r1` scope skill as an `r0` skill. The lookup
  failed before implementation work, the correct catalog path was read
  successfully, and no project, provider, or private state changed.
- 2026-07-29T21:48:32.2142290Z: A combined read-only instruction lookup
  again treated the catalog-declared `r1` scope skill as an `r0` skill. The
  lookup failed before implementation work, the catalog-mapped path was then
  read successfully, no private data entered the output, and repository and
  provider state were unchanged.
- 2026-07-30T00:04:59.1318088Z: The independent Task 7 reviewer used the
  `r0` root for two catalog-declared `r1` skills. Both read-only lookups
  reported missing paths before the reviewer opened the immutable package.
  Review paused, no project or provider state changed, and the reviewer was
  redirected to expand the declared root aliases.
- 2026-07-30T00:19:33.7014177Z: The wave-3 implementer again used `r0` for
  `scope-gate` and `trace-live-call-path`, both catalog-declared `r1` skills.
  The read-only failures occurred before implementation work; no project,
  provider, or private state changed.
- 2026-07-30T20:41:43.4474977Z: The Task 3 implementer used `r0` for the
  catalog-declared `r1` scope-gate skill. The single read-only lookup failed
  before repository work; no file, provider, or private state changed. The
  implementer was redirected to the exact declared root.
- 2026-07-30T23:23:52.8198469Z: The Task 3 final-repair implementer repeated
  the same `r0` lookup for the catalog-declared `r1` scope-gate skill. The
  read-only failure occurred before repair work; no repository, provider, or
  private state changed. The implementer was again redirected to the exact
  catalog path.
- 2026-07-31T01:30:11.4699741Z: The Task 3 timestamp/lifecycle adjudicator
  again inferred the `r0` path for the catalog-declared `r1` scope-gate skill.
  It stopped before repository inspection, emitted no private value, and
  changed no state. The resumed task is given the exact declared root and is
  forbidden from inferring any other skill location.
