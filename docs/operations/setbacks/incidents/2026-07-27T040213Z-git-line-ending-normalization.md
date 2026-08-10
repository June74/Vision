# SB-20260727-040213-git-line-ending-normalization: Git reported line-ending normalization

- **Status:** contained
- **First observed:** 2026-07-27T04:02:13Z
- **Last observed:** 2026-08-02T20:10:57.7489950Z
- **Phase/task:** Phase B acceptance instrumentation through OAuth reconnect Task 5 isolated-candidate verification
- **Environment:** Local Phase B worktree
- **Version/commit:** `4420f6d`

## Symptom

Git warned that line-feed working-copy content in edited setback documents
would be normalized to carriage-return plus line-feed on a later Git touch.

## Impact

Earlier documentation and whitespace checks exited successfully. In the Task 5
recurrence, a fresh detached Windows checkout wrote byte-sensitive committed LF
files as CRLF, causing three isolated-candidate unit assertions to fail. No
semantic content, provider state, or private value changed.

## Reproduction conditions

Run a diff check after patching tracked Markdown files in a Windows checkout
whose Git automatic line-ending conversion is enabled.

## Safe evidence

Git reported LF index content and LF or mixed working-copy content for the
three tracked setback files. Repository configuration reported automatic
conversion enabled.

## Attempts and outcomes

- The initial documentation and whitespace checks both exited zero.
- A bounded end-of-line inspection confirmed the warning was normalization
  metadata rather than a content error.

## Cause classification

- **Confirmed cause:** Windows Git automatic line-ending conversion detected
  patched LF content in files whose working-copy form is normalized.
- **Hypotheses:** None.
- **Rejected hypotheses:** The warning did not report a failed diff or
  malformed documentation. Disabling automatic conversion for the check is
  not a valid workaround in this checkout because existing carriage returns
  are then interpreted as trailing whitespace.
- **Known exclusions:** No broad formatting rewrite, provider action, secret
  operation, or external write occurred.

## Correction and prevention

- **Correction:** Preserve normal repository behavior in the primary worktree.
  Recreate only the generated detached artifacts with command-scoped LF
  checkout settings, and prove byte-sensitive files equal their committed blobs
  before running artifact CI.
- **Prevention:** Treat normalization warnings as non-blocking only when the
  relevant byte-sensitive checks pass. Immutable release artifacts on Windows
  must prove committed-blob byte equality before dependency installation.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Recreate the short candidate and rollback artifacts
  with command-scoped LF checkout and verify exact blob hashes.

## Verification and related work

The documentation validator and `git diff --check` both exited zero before
this incident was recorded.

## Recurrence history

- 2026-07-27T04:02:13Z: First observed and closed after bounded inspection.
- 2026-07-27T04:04:09Z: Recurred when a command-scoped conversion override
  made existing carriage returns appear as trailing whitespace. The override
  was rejected; no file was staged or committed.
- 2026-07-27T04:58:22Z: Recurred during the Task 3 final whitespace check.
  The check exited zero; the warning remained limited to expected Windows
  normalization metadata for edited text files.
- 2026-07-27T18:04:36Z: Recurred during Task 4 documentation and whitespace
  verification for the value-free live containment records. Both checks
  exited zero; no broad formatting rewrite was performed.
- 2026-07-27T18:06:02Z: Recurred during the bounded privacy scan of the same
  documentation diff. The scan returned zero prohibited patterns and no
  formatting rewrite was performed. Remaining Git output is captured and
  classified before display.
- 2026-07-27T21:15:38Z: Recurred during Task 1 focused verification. The
  workflow test, documentation validator, and `git diff --check` all exited
  zero; the warning remained limited to expected Windows normalization metadata.
- 2026-07-27T21:34:04.0505403Z: Recurred during Task 2 blocked-report
  verification for value-free setback records. Documentation validation,
  `git diff --check`, and the bounded report privacy scan all exited zero; no
  formatting rewrite was performed.
- 2026-07-27T23:52:52.7850873Z: Recurred during the amended Task 2 blocked
  report validation for value-free setback records. Documentation validation,
  security scanning, and `git diff --check` all exited zero; no formatting
  rewrite was performed.
- 2026-07-28T02:26:35.1058775Z: Recurred during the preview role-probe
  changed-file and privacy review. The complete repository gate and
  `git diff --check` exited zero; no formatting rewrite, provider action, or
  private-data operation was performed.
- 2026-07-28T14:35:22Z: Recurred during verification of the resumed setback
  records. `pnpm docs:check` and `git diff --check` both exited zero; no
  formatting rewrite, provider action, or private-data operation was
  performed.
- 2026-07-28T19:04:20.7909464Z: Recurred during Task 1 self-review after
  `git diff --check` exited zero. The warnings were limited to expected Windows
  normalization metadata for edited text files; no broad formatting rewrite,
  provider action, or private-data operation was performed.
- 2026-07-28T19:16:29.0511425Z: Recurred during the Task 1 final whitespace
  check. Suppressing the known warning stream made the combined PowerShell
  invocation report a nonzero status without a diff error. The ordinary
  `git diff --check` rerun exited zero and reported only expected Windows
  normalization metadata; no formatting rewrite or external action occurred.
- 2026-07-28T19:17:56.2271846Z: Recurred during successful Task 1 staging
  through the approved linked-worktree metadata boundary. All explicit paths
  were staged; the warnings remained expected Windows normalization metadata
  and no formatting rewrite or external action occurred.
- 2026-07-28T19:59:44.7378306Z: Recurred during the Task 2 read-only diff and
  whitespace review. `git diff --check` exited zero; warnings remained limited
  to expected Windows normalization metadata, and no formatting rewrite or
  external action occurred.
- 2026-07-29T23:49:18.1537051Z: A final-fix wrapper temporarily disabled
  automatic line-ending normalization in an attempt to suppress warning
  output. That made existing CRLF bytes appear as trailing whitespace and
  produced a false nonzero diff result. No file changed; the ordinary
  repository-configured check is used for the authoritative result.
- 2026-07-30T00:00:24.4439832Z: Recurred while verifying the review-package
  helper setback record. Documentation and whitespace checks exited zero; the
  warning remained expected Windows normalization metadata. No provider state
  or semantic content changed.
- 2026-07-30T00:07:26.8684156Z: Recurred while staging the final-review
  setback records. Documentation validation had exited zero; the warning
  remained expected Windows normalization metadata, and no external state or
  semantic content changed.
- 2026-07-30T02:56:25.4759565Z: Recurred while staging the final formal-review
  handoff incident. Documentation validation had exited zero; the warning
  remained expected Windows normalization metadata, and no external state or
  semantic content changed.
- 2026-07-30T03:07:03.8217300Z: Recurred while verifying the current
  setback-only documentation delta. The repository-configured documentation
  validator and diff check both exited zero. The warning remained expected
  Windows normalization metadata; no formatting rewrite or external action
  occurred.
- 2026-07-30T18:04:07.7440842Z: Recurred during the live-acceptance plan freeze
  check across edited plan/spec and setback Markdown. Documentation validation
  and `git diff --check` exited zero; no formatting rewrite, provider action, or
  semantic-content change was performed.
- 2026-07-30T18:08:07.1088786Z: Recurred during the final post-review plan
  whitespace check after exact-path staging instructions were added. The check
  exited zero; the warnings remained Windows normalization metadata only.
- 2026-07-30T19:31:15.9144398Z: Recurred during the Task 1 exact-path diff
  audit. `git diff --check` exited zero, no file was staged or rewritten by
  Git, and no provider or external state changed.
- 2026-07-30T19:52:18.7464363Z: Recurred during a read-only name-only check of
  the Task 1 review-fix paths. Git reported the same expected working-copy
  normalization warning; it did not stage or rewrite files and no external
  state changed.
- 2026-07-30T20:36:52.1315852Z: Recurred while inventorying the setback-only
  documentation delta before its dedicated commit. Direct process capture
  classified fourteen stderr lines as this known warning and proved Git exited
  zero; no file was staged or rewritten by the read.
- 2026-07-30T20:38:40.2393105Z: The approved setback-only stage completed and
  emitted the same normalization metadata for its exact documentation paths.
  No semantic rewrite or external action occurred; the immediate bookkeeping
  restage is part of this same closed recurrence.
- 2026-07-31T02:24:53.1224621Z: The isolated restore repair's final
  `git diff --check` exited zero and reported expected Windows working-copy
  normalization metadata for four changed text files. No whitespace error,
  content rewrite, path output, or external state change occurred; staged
  blobs will be verified without changing line-ending configuration.
- 2026-08-02T18:11:20.4149554Z: Recurred during reconnect Task 2 diagnostic
  verification across already-dirty operational ledgers. The repository-
  configured `git diff --check` exited zero, and the release security scan also
  passed. No normalization override, content rewrite, staging, secret, or
  external action occurred.
- 2026-08-02T18:46:12.1422911Z: Recurred while inspecting the one-file Task 2
  cleanup hardening diff. The warning was limited to expected Windows
  normalization metadata; the cleanup regression, non-approved skip gate,
  TypeScript check, and whitespace check all passed. No file was normalized or
  staged by the inspection.
- 2026-08-02T20:10:57.7489950Z: A fresh short detached candidate converted
  committed LF workflow and migration bytes to CRLF. Two literal workflow tests
  and one pinned migration hash failed while 1,753 other unit/integration
  assertions passed. The generated artifacts remain undeployed and are being
  recreated with command-scoped LF checkout settings.
