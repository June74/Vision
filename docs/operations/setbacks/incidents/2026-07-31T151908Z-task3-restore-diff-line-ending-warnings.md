# SB-20260731-151908-task3-restore-diff-line-ending-warnings: Restore diff check emitted Windows normalization advisories

- **Status:** closed
- **First observed:** 2026-07-31T15:19:08.6191275Z
- **Last observed:** 2026-07-31T15:19:08.6191275Z
- **Phase/task:** Phase B Task 3 restore-input bounds repair
- **Environment:** Windows Git owned-diff verification
- **Version/commit:** 73191b7 plus unstaged GREEN repairs and setback records

## Symptom

The owned `git diff --check` exited successfully but emitted one line-ending
normalization advisory for each of the eight restore-owned paths.

## Impact

The diff is whitespace-clean. The output is not warning-free, but the warnings
do not identify a patch defect and do not justify an in-scope content rewrite.

## Reproduction conditions

Run Git diff validation on LF worktree content under the repository's Windows
line-ending conversion configuration.

## Safe evidence

Only the aggregate warning count and normalization category were reported. No
file content, URI, credential, protected identifier, provider value, runtime
stream, argument, or environment value was emitted.

## Attempts and outcomes

- Diff validation exited zero.
- Security evidence and repository security scan both exited zero.
- No file changed as a result of the check.

## Cause classification

- **Confirmed cause:** Windows Git line-ending normalization advisory.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** No whitespace error or security failure exists.
- **Known exclusions:** No provider, network, Git index, or external mutation
  occurred.

## Correction and prevention

- **Correction:** None; accept the zero-exit diff result and avoid unrelated
  line-ending churn.
- **Prevention:** Evaluate this advisory separately from `diff --check`
  violations in Windows worktrees.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

Restore tests pass 38/38, TypeScript has zero diagnostics at its lane
checkpoint, security evidence and security scan pass, and owned diff validation
exits zero.

## Recurrence history

- 2026-07-31T15:19:08.6191275Z: Observed, classified as non-blocking, and
  closed without formatting churn.
