# SB-20260726-203035-git-global-ignore-unreadable: Git global ignore file was unreadable

- **Status:** closed
- **First observed:** 2026-07-26T20:30:35.2961897Z
- **Last observed:** 2026-08-03T17:52:01.2520470Z
- **Phase/task:** Phase B live-acceptance specification finalization through corrected redeploy controller verification
- **Environment:** Local Phase B worktree under the managed sandbox
- **Version/commit:** Written-spec candidate based on `38c35eb`

## Symptom

Git reported that the user's global ignore file could not be read while checking
the worktree state.

## Impact

The status and upstream checks still succeeded. No repository or provider state
changed.

## Reproduction conditions

Run a Git command that consults the user-level ignore configuration while the
managed sandbox cannot read that file.

## Safe evidence

Git returned the expected clean branch, upstream, and zero-ahead/zero-behind
results, followed by a permission warning for the global ignore file.

## Attempts and outcomes

- The repository check completed successfully despite the warning.
- The warning was classified as a local configuration-read limitation rather
  than a repository failure.

## Cause classification

- **Confirmed cause:** The managed process lacked permission to read the
  user-level Git ignore file.
- **Hypotheses:** None.
- **Rejected hypotheses:** The linked worktree and remote branch were not
  unavailable. Overriding the excludes file with the Windows `NUL` device is
  not supported by this Git build.
- **Known exclusions:** No project file, commit, or deployment changed.

## Correction and prevention

- **Correction:** Accepted the independently successful repository results and
  made no configuration change outside the project.
- **Prevention:** Treat this exact warning as non-blocking when the Git command
  exits successfully and its requested repository results are present.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The branch was clean, tracked its expected remote, and was synchronized at
commit `4420f6d`.

## Recurrence history

- 2026-07-26T20:30:35.2961897Z: First observed.
- 2026-07-26T20:31:38.8232065Z: Recurred during documentation and diff
  verification; the checks still completed successfully.
- 2026-07-26T20:53:19.9855914Z: Recurred during the pre-commit status and
  diff check; all requested repository results were still returned.
- 2026-07-26T20:54:22.5223781Z: An attempted `NUL` excludes-file override
  failed before the Git diff check. Documentation had already passed; the
  diff check was rerun normally instead of pursuing another workaround.
- 2026-07-27T00:24:17Z: Recurred during the AI Gateway identifier pre-commit
  status check. Git returned the requested state successfully.
- 2026-07-27T01:52:24Z: Recurred during the post-push branch synchronization
  check. Git returned an empty worktree status and matching local and remote
  commit identifiers.
- 2026-07-27T03:56:50Z: Recurred during Task 3 repository inspection. Git
  returned the requested branch, commit, and status data successfully; no
  configuration workaround or provider action was attempted.
- 2026-07-27T18:04:36Z: Recurred during restore Task 4 documentation and
  whitespace verification. Both checks exited zero and Git returned the
  requested status; no configuration workaround was attempted.
- 2026-07-27T18:07:39Z: Recurred during the read-only staged privacy check.
  The check confirmed 18 operations files and zero prohibited patterns; no
  configuration workaround was attempted. Remaining Git output is captured
  and classified before display.
- 2026-07-27T21:24:34.4110712Z: Recurred during the Task 2 immutable-candidate
  check. Git returned matching local and remote candidate commits, and the
  focused test command passed all 7 tests. No configuration workaround or
  provider action was attempted.
- 2026-07-27T23:34:27.6431391Z: Recurred during the amended Task 2
  immutable-candidate check. Git returned matching local and remote candidate
  commits, and the focused test command passed all 7 tests. No configuration
  workaround or provider action was attempted.
- 2026-07-28T00:25:50.5676199Z: Recurred during the Task 2 implementation
  preflight status check. Git returned the expected commit and worktree state;
  no configuration workaround or provider action was attempted.
- 2026-07-28T00:52:25.6785004Z: Recurred during the final Task 2 changed-file
  inventory. Git returned the complete worktree status and diff inventory; no
  configuration workaround or provider action was attempted.
- 2026-07-28T01:20:44.6624354Z: Recurred during Task 3 candidate
  reconfirmation. The ordinary status check had already returned a clean,
  synchronized worktree; a repeated `NUL` excludes-file workaround was
  rejected before the retry. No repository or provider mutation occurred, and
  the unsupported workaround is not reused.
- 2026-07-28T02:02:31.3503418Z: Recurred during the preview role probe
  implementation preflight. Git returned the exact branch and base commit
  successfully; no configuration workaround, provider action, or repository
  runtime mutation occurred.
- 2026-07-28T02:36:34.6558608Z: Recurred during the independent staged-diff
  review. Git returned the requested inventory and diff successfully. The
  reviewer approved the staged implementation with zero Critical or Important
  findings; no provider or runtime mutation occurred.
- 2026-07-28T13:58:00Z: Recurred during a final short-status check. Git exited
  zero and returned no changed paths, but the warning-bearing result was not
  accepted as fresh clean proof; the controller's independent clean
  attribution was used.
- 2026-07-28T14:08:00Z: Recurred during the ignored-report acceptance gate.
  A supported null exclude-file override then returned the tracked-state result
  without changing repository or provider state.
- 2026-07-28T14:32:43Z: Recurred during the Phase B completion resume
  preflight. Git returned the requested branch, commit, worktree, and plan
  state with exit code zero; no configuration workaround, repository mutation,
  or provider action was attempted.
- 2026-07-28T14:33:13Z: The controller mistakenly retried the already-rejected
  Windows `NUL` excludes-file workaround while seeking a warning-free status
  check. Git failed before reading repository state; no file or provider state
  changed. Future checks must accept the ordinary successful result and
  classify only the known trailing warning.
- 2026-07-28T14:35:22Z: Recurred during the resumed setback diff and status
  checks. Both requested Git operations exited successfully and returned their
  requested results; no workaround or external action was attempted.
- 2026-07-28T14:44:32Z: Recurred when a status check suppressed the known
  warning stream. Git still returned the four expected modified setback paths,
  but the shell reported a nonzero native-command status, so that invocation
  was not accepted as clean-state proof. No repository or provider mutation
  occurred.
- 2026-07-28T14:54:48Z: Recurred after the bounded clean/equality check. The
  command separately confirmed a clean tracked worktree, clean index, and
  matching local and remote commits before the warning appeared; no workaround
  or mutation was attempted.
- 2026-07-28T15:05:48Z: Recurred during the approved acceptance-design
  preflight. The command separately confirmed a clean tracked worktree, the
  expected branch, matching local and remote commits, and absence of the new
  design file before the warning appeared; no workaround or external mutation
  was attempted.
- 2026-07-28T18:35:01Z: Recurred during the implementation-plan status and
  ignore check. Git returned the two modified setback files and the new plan
  path before the known warning. No workaround, provider action, or unrelated
  repository mutation was attempted.
- 2026-07-28T18:47:00.4534017Z: Recurred during the Task 1 dependency-linkage
  status check. Git returned the complete changed-file list before the known
  warning. No workaround, provider action, or unrelated repository mutation
  was attempted.
- 2026-07-28T19:04:20.7909464Z: Recurred during the Task 1 explicit tracked
  and untracked inventory. Git returned the complete inventory before the
  known warning. No workaround, provider action, or unrelated repository
  mutation was attempted.
- 2026-07-28T19:17:15.0700713Z: Recurred during the post-denial staged
  inventory. Git returned the requested empty index state before the known
  warning. No configuration workaround, provider action, or unrelated
  repository mutation was attempted.
- 2026-07-28T19:40:26.0838768Z: Recurred during the Task 2 implementation
  preflight status check. Git returned the expected branch, base commit, and
  empty worktree inventory before the known warning. No configuration
  workaround, provider action, or unrelated repository mutation was attempted.
- 2026-07-30T04:21:35.4114952Z: Recurred during the live-acceptance written-spec
  pre-commit Git checks. Status returned the expected branch and sole untracked
  specification, and the staged whitespace check exited successfully before
  the known warning. No workaround, provider action, or unrelated repository
  mutation was attempted.
- 2026-07-31T16:54:31.0457568Z: Recurred during the fourth-wave resolver
  repair preflight. Repository-local status succeeded before the sandbox denied
  the optional user-level ignore read. No configuration change, file edit,
  provider action, secret access, or external mutation occurred; the lane may
  continue without consulting or modifying global Git configuration.
- 2026-07-31T21:55:11.3910509Z: Recurred during the Task 4 staged-scope audit.
  The expected 42 staged paths and zero unstaged paths were reported, but the
  untracked-file query inherited the optional unreadable global ignore and the
  compound command exited nonzero. The scope claim is rechecked with bounded
  repository-metadata read authority before commit.
- 2026-07-31T22:03:47.5242582Z: Recurred during a Task 5 browser-lane scoped
  status check. Git exited zero and reported no assigned-path changes; the
  optional user-level ignore warning remains a known sandbox advisory.
- 2026-07-31T22:44:53.4169222Z: Recurred during Task 6's read-only authoring
  document identity check. Git exited zero and confirmed both frozen documents
  unchanged from `44d8e93`; the optional global-ignore warning was advisory.
- 2026-07-31T22:46:12.5273914Z: Recurred during the Task 6 cleanup-lane scoped
  status check. Git exited zero and reported no assigned-path changes; the
  optional global-ignore warning remained advisory and no state changed.
- 2026-07-31T23:13:04.2605523Z: Recurred during the controller's read-only
  Task 6 branch-status check. Git returned the requested repository status and
  history successfully; only the optional user-level ignore read was denied,
  with no repository, provider, credential, or external-state impact.
- 2026-08-01T00:30:55.8019521Z: Recurred during the corrected Task 6 exact-scope
  audit. All three Git commands exited zero and proved 54 status paths, all
  confined to the 29-path Task 6 allowlist or setback ledger, with zero staged
  or unexpected path. The optional global-ignore reads remained advisory.
- 2026-08-01T00:32:30.8793280Z: Recurred during the staged setback-ledger audit.
  Git still exited zero and proved 27 cached ledger paths, zero unexpected
  cached path, and a clean cached diff. Only this recurrence and its index row
  require restaging before the separate ledger commit.
- 2026-08-02T17:34:20.6646398Z: Recurred during reconnect-recovery Task 3
  repository preflight. Git exited zero and confirmed the expected worktree,
  branch, base commit, dirty ledger state, and clean Task 3 path set. The
  optional user-level ignore warning remained advisory; no application,
  staging, provider, secret, or external state changed.
- 2026-08-02T17:38:53.2285892Z: Recurred during reconnect-recovery Task 3's
  read-only cached-path check after the four-file diff review. Git exited zero
  and confirmed no staged path; the warning remained advisory. Subsequent Git
  commands use the task-local diagnostic configuration path.
- 2026-08-02T19:40:34.3659025Z: Recurred during the reconnect-recovery final
  candidate freeze. The checks exited zero and independently proved the exact
  ten-path allowlist, zero implementation residue, zero staged paths, clean
  diff, canonical candidate, and passing security scan. The optional
  user-level ignore warning remained advisory; no repository or external state
  changed.
- 2026-08-02T20:32:19.2240569Z: Recurred during the approved short-artifact
  preflight. Both repository-local ignore checks exited zero and all path,
  registration, branch, commit, and object guards returned true before the
  optional global-ignore permission warning. No project or external state
  changed.
- 2026-08-02T21:56:33.6328945Z: Recurred during independent verification of
  the newly created short LF artifacts. A generic wrapper stopped at the first
  nonzero Git subcheck after the known global-ignore warning, but did not
  identify the subcommand. The incomplete result was discarded. The confirmed
  warning remains sandbox-local; which subcheck returned nonzero is still a
  hypothesis pending labeled read-only diagnosis. No artifact, repository, or
  external state changed during verification.
- 2026-08-02T21:58:18.6675488Z: Labeled diagnosis closed the recurrence. The
  warning was present, but both tracked-status checks exited zero; the generic
  wrapper actually stopped on absent persistent `core.eol` configuration.
  The warning therefore remains a known advisory and was rejected as the cause
  of the verifier failure.
- 2026-08-02T22:00:31.9006270Z: Recurred as an advisory during the successful
  explicit artifact verifier. All requested invariant checks completed and
  returned true; no workaround, repository mutation, or external action was
  required.
- 2026-08-02T22:05:13.2222238Z: Recurred during the post-offline-install
  immutability check. The command still returned a tracked-clean candidate and
  byte-identical lockfile; the warning remained advisory and no workaround or
  external action occurred.
- 2026-08-02T22:06:15.1618737Z: Recurred during the successful candidate
  dependency/path immutability check. All requested results remained valid.
  Future Git-only diagnostics set a task-local `XDG_CONFIG_HOME` instead of
  consulting the unreadable optional user-level ignore location.
- 2026-08-02T23:06:09.5268022Z: Recurred as an advisory during the read-only
  rollback evidence status check because that command omitted the task-local
  diagnostic configuration. Git exited zero and returned the expected ledger
  changes; no repository or external state changed. Remaining Git-only checks
  must set the task-local `XDG_CONFIG_HOME` already established for this task.
- 2026-08-03T17:52:01.2520470Z: Recurred during the corrected-controller
  worktree inventory because the Git command again omitted task-local
  `XDG_CONFIG_HOME`. Git exited zero and returned the requested branch, dirty
  inventory, and ignored-controller facts before the advisory. No repository
  or external state changed; subsequent Git-only checks use the in-worktree
  diagnostic configuration.
