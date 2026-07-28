# SB-20260727-023338-approved-spec-trailing-whitespace: Approved spec header had trailing whitespace

- **Status:** closed
- **First observed:** 2026-07-27T02:33:38Z
- **Last observed:** 2026-07-28T15:14:01Z
- **Phase/task:** Phase B acceptance instrumentation design
- **Environment:** Local Phase B worktree
- **Version/commit:** `6fdb9cb`

## Symptom

The diff whitespace gate rejected two approved-spec header lines.

## Impact

The documentation coverage check passed, but the plan handoff could not be
committed until the formatting defect was removed. No runtime or provider
state changed.

## Reproduction conditions

Run `git diff --check` while the two Markdown header lines end with spaces.

## Safe evidence

The gate identified only lines 3 and 6 of the restore design specification.

## Attempts and outcomes

- Documentation coverage exited successfully.
- The whitespace gate failed on exactly two spec-header lines.

## Cause classification

- **Confirmed cause:** Two approval metadata lines contained trailing spaces.
- **Hypotheses:** None.
- **Rejected hypotheses:** The implementation plan itself did not contain the
  reported whitespace.
- **Known exclusions:** No source, secret, key, database, or provider setting
  changed.

## Correction and prevention

- **Correction:** Remove the two trailing spaces and rerun both gates.
- **Prevention:** Run `git diff --check` after editing Markdown metadata.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

Closure requires a successful documentation coverage check and a clean diff
whitespace gate.

## Recurrence history

- 2026-07-27T02:33:38Z: First observed and contained.
- 2026-07-27T20:46:34Z: A new restore-retry design repeated the Markdown
  metadata hard-break pattern. The whitespace gate caught three affected
  header lines before staging. The spaces were replaced with blank-line
  paragraph separation; no runtime or provider state changed.
- 2026-07-28T15:14:01Z: The approved acceptance-instrumentation specification
  repeated the Markdown hard-break pattern on three metadata lines. The staged
  whitespace gate stopped the commit; the spaces were replaced with blank-line
  paragraph separation before retry. No runtime or provider state changed.
