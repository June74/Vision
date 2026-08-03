# SB-20260803-191836-git-nul-excludes-override-invalid: Git rejected the NUL excludes-file diagnostic override

- **Status:** resolved
- **First observed:** 2026-08-03T19:18:36.412725Z
- **Last observed:** 2026-08-03T19:18:36.412725Z
- **Phase/task:** Phase B controller repair design
- **Environment:** Local Git diagnostics on Windows
- **Version/commit:** Task 1 controller repair design

## Symptom

A local branch and status probe used core.excludesFile=NUL; Git reported that NUL cannot be used as an excludes file, making the status count unreliable.

## Impact

No repository or provider state changed; branch and recent commit values were returned, but worktree cleanliness must be rechecked with a valid local override.

## Reproduction conditions

Set `core.excludesFile=NUL` for a local Git status diagnostic.

## Safe evidence

- Git rejected `core.excludesFile=NUL` in this environment.
- The earlier clean count from that invalid override was discarded.
- `.gitignore` provided the safe repository-local diagnostic override.

## Attempts and outcomes

1. The NUL excludes-file diagnostic override was rejected by Git.
2. Its clean-count result was discarded as unreliable.
3. A `.gitignore` repository-local override was used for later diagnostics.

## Cause classification

- **Confirmed cause:** `core.excludesFile=NUL` is invalid in this environment.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The earlier NUL-based clean count was reliable.
- **Known exclusions:** No repository or provider state changed.

## Correction and prevention

- **Correction:** Discarded the invalid count and used `.gitignore` as the
  repository-local diagnostic override.
- **Prevention:** Do not use `NUL` as a Git excludes file here; use the safe
  repository-local `.gitignore` override for diagnostics.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None for this incident.

## Verification and related work

Later repository-local diagnostics used the `.gitignore` override successfully.

## Recurrence history

- 2026-08-03T19:18:36.412725Z: First observed.
- 2026-08-03: Invalid count discarded and safe local override established;
  incident resolved.
