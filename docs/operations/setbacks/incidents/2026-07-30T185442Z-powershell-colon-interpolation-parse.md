# SB-20260730-185442-powershell-colon-interpolation-parse: PowerShell parsed a path interpolation as a scoped variable

- **Status:** closed
- **First observed:** 2026-07-30T18:54:42.424692Z
- **Last observed:** 2026-07-30T18:55:03.4418654Z
- **Phase/task:** Phase B live-acceptance closure final plan verification
- **Environment:** Local Phase B linked worktree, Windows PowerShell
- **Version/commit:** `c8879b2`

## Symptom

A read-only whitespace checker failed to parse because a colon immediately followed an interpolated path variable.

## Impact

The verification command paused before reading or changing files; no repository, provider, credential, or external state changed.

## Reproduction conditions

Interpolate `"$path:$lineNo trailing whitespace"` in Windows PowerShell, where
the colon is parsed as part of a scoped variable reference.

## Safe evidence

PowerShell stopped at parse time with an invalid-variable-reference category;
the command did not begin file iteration.

## Attempts and outcomes

Replaced string interpolation with the format operator:
`'{0}:{1} ...' -f $path,$lineNo`.

## Cause classification

- **Confirmed cause:** A colon immediately after `$path` is ambiguous with
  PowerShell scoped-variable syntax.
- **Hypotheses:** None remain.
- **Rejected hypotheses:** A plan or spec content error; parsing failed before
  either file was evaluated.
- **Known exclusions:** No file, Git index, provider, or credential state
  changed.

## Correction and prevention

- **Correction:** Use the format operator for path-plus-line diagnostics.
- **Prevention:** Do not place punctuation directly after an unbraced variable
  in PowerShell diagnostic strings.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The corrected checker completed with zero whitespace/conflict-marker issues;
the tracked spec also passed `git diff --check`.

## Recurrence history

- 2026-07-30T18:54:42.424692Z: First observed.
- 2026-07-30T18:55:03.4418654Z: Closed after the format-string correction and
  successful rerun.
