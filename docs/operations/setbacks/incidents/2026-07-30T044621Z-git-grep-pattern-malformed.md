# SB-20260730-044621-git-grep-pattern-malformed: Git grep pattern was malformed

- **Status:** closed
- **First observed:** 2026-07-30T04:46:21.913442Z
- **Last observed:** 2026-07-30T04:46:21.913442Z
- **Phase/task:** Phase B live-acceptance implementation planning
- **Environment:** Local Phase B worktree
- **Version/commit:** `c8879b2`

## Symptom

A read-only path-mapping query passed punctuation as a regular expression and Git rejected that one pattern.

## Impact

One search branch returned no paths; other bounded searches completed. No repository or external state changed.

## Reproduction conditions

Run a Git content search for a punctuation-bearing literal without selecting
fixed-string mode.

## Safe evidence

Git rejected one malformed pattern while the surrounding read-only path
inventory continued. No matched content was printed for the failed branch.

## Attempts and outcomes

- The invalid regular-expression branch was stopped.
- The same literal was searched with fixed-string mode; Git exited zero and
  returned twelve tracked paths.

## Cause classification

- **Confirmed cause:** Punctuation intended as literal text was passed to the
  default regular-expression parser.
- **Hypotheses:** None.
- **Rejected hypotheses:** The target text was not absent; fixed-string search
  found twelve tracked paths.
- **Known exclusions:** No source, Git, secret, database, Worker, or provider
  state changed.

## Correction and prevention

- **Correction:** Re-ran the bounded path query with `git grep -F`.
- **Prevention:** Use fixed-string mode for punctuation-bearing source
  fragments and reserve regular-expression mode for reviewed expressions.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected query exited zero and returned only tracked relative paths.

## Recurrence history

- 2026-07-30T04:46:21.913442Z: First observed.
