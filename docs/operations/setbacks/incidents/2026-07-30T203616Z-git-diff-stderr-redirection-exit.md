# SB-20260730-203616-git-diff-stderr-redirection-exit: Tracked-path check returned nonzero with stderr suppression

- **Status:** closed
- **First observed:** 2026-07-30T20:36:16.505177Z
- **Last observed:** 2026-07-30T20:36:52.1315852Z
- **Phase/task:** Phase B live-acceptance closure setback-ledger commit
- **Environment:** Local Windows PowerShell linked worktree
- **Version/commit:** `67bb6e3fae57b97d1440c5e410aac88ca0293f06`

## Symptom

A read-only git diff name-only command returned the complete expected path list but the shell reported exit code one when native stderr was redirected to the null sink.

## Impact

Setback-ledger staging paused for diagnosis; no file, index, provider, or external state changed.

## Reproduction conditions

Redirect Git's known working-copy normalization warnings through PowerShell's
native stderr redirection while relying on the outer shell result.

## Safe evidence

A direct process capture proved Git itself exited zero, returned fifteen
tracked paths all under the setback directory, and wrote fourteen messages
matching only the already classified normalization-warning shape.

## Attempts and outcomes

- The shell-wrapped command returned the correct path list but the tool wrapper
  reported nonzero.
- A direct `System.Diagnostics.Process` capture separated Git's actual exit
  code from stderr and validated both output classes without rendering stderr.

## Cause classification

- **Confirmed cause:** The PowerShell/tool stderr-redirection boundary promoted
  known native warning records into the outer failure result even though Git
  exited zero.
- **Hypotheses:** None.
- **Rejected hypotheses:** Git did not fail and no non-setback tracked path was
  modified.
- **Known exclusions:** No file, index, provider, private-data, or external
  state changed.

## Correction and prevention

- **Correction:** Use direct process capture for Git commands whose known stderr
  warnings must be discarded, and evaluate the native exit code explicitly.
- **Prevention:** Do not infer a native Git failure from the PowerShell wrapper
  result when stderr redirection is present; validate exit code and bounded
  stdout/stderr classes separately.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

Direct capture exited zero, proved all fifteen tracked paths were setback
paths, and classified all fourteen stderr lines as known normalization
warnings.

## Recurrence history

- 2026-07-30T20:36:16.505177Z: First observed.
