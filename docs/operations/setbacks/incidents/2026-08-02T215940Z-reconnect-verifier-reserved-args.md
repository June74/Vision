# SB-20260802-215940-reconnect-verifier-reserved-args: Artifact verifier used the reserved PowerShell args variable

- **Status:** closed
- **First observed:** 2026-08-02T21:59:40.629311Z
- **Last observed:** 2026-08-02T22:00:31.9006270Z
- **Phase/task:** Phase B OAuth reconnect Task 5 artifact verification
- **Environment:** Local Windows PowerShell, short detached Git worktrees
- **Version/commit:** candidate `c1911f8`; rollback `94b8810`

## Symptom

The corrected verifier helper bound its Git argument parameter to the reserved automatic args variable, so Git received no subcommand and the verifier stopped.

## Impact

The second independent artifact verdict was discarded; no artifact, source, Git metadata, provider, or external state changed.

## Reproduction conditions

Declare a PowerShell function parameter named `$args`, pass a Git subcommand as
its second positional argument, then invoke Git with that automatic variable.

## Safe evidence

The safe exception category was `git_read_failed` with an empty command label.
No Git or provider payload was retained.

## Attempts and outcomes

- The incomplete second verdict was discarded immediately.
- The empty command label identified parameter binding rather than an artifact
  or Git repository failure.

## Cause classification

- **Confirmed cause:** The verifier used PowerShell's reserved automatic
  `$args` variable as an explicit helper parameter, leaving the intended Git
  argument list empty.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Neither candidate nor rollback Git state caused the
  empty subcommand.
- **Known exclusions:** No artifact, source, index, commit, provider,
  credential, key, database, calendar, or deployment state changed.

## Correction and prevention

- **Correction:** Remove the helper and run explicit, labeled Git commands.
- **Prevention:** Do not use PowerShell automatic-variable names for function
  parameters in diagnostic wrappers.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The helper-free explicit verifier completed with exit zero and returned true
for every required invariant in both artifacts.

## Recurrence history

- 2026-08-02T21:59:40.629311Z: First observed.
- 2026-08-02T21:59:45.0653882Z: Contained after the empty safe command label
  confirmed the reserved-variable binding error.
- 2026-08-02T22:00:31.9006270Z: Closed after replacing the helper with
  explicit commands and obtaining a complete all-true verdict.
