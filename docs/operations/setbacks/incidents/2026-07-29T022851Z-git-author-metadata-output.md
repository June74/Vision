# SB-20260729-022851-git-author-metadata-output: Commit inspection rendered unnecessary author metadata

- **Status:** closed
- **First observed:** 2026-07-29T02:28:51.410643Z
- **Last observed:** 2026-08-02T17:25:12.2473604Z
- **Phase/task:** Phase B reconnect-recovery Task 1 post-commit verification
- **Environment:** Windows PowerShell, isolated phase-b-foundation worktree
- **Version/commit:** `97ff26d`

## Symptom

A local Git inspection used a full metadata format and rendered an author personal identifier in tool output.

## Impact

The value appeared only in local task tooling; no external system was contacted, and no secret, token, provider identifier, or application record was involved.

## Reproduction conditions

Running `git show` with a full commit metadata format while reviewing the two
named Task 4 commits.

## Safe evidence

- The rendered value was Git author metadata only.
- No external tool or network operation was involved.
- Subsequent Git inspection uses explicit safe fields or patch-only output.

## Attempts and outcomes

- Contained the output and stopped metadata-bearing Git inspection.
- Switched the remaining review to `--format=` or explicit hash/subject fields.

## Cause classification

- **Confirmed cause:** The inspection command requested the full commit header
  even though only file and patch evidence was required.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No credentials, tokens, authorization material, provider
  identifiers, account identifiers, or application records were rendered.

## Correction and prevention

- **Correction:** Use metadata-suppressed Git formats for every remaining
  commit and diff inspection in this task.
- **Prevention:** Default review commands to `git show --format=` and request
  individual safe fields only when commit identity is necessary.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

- A metadata-suppressed `git show --format=` check completed with patch/file
  information and no author fields.
- The Task 1 recurrence was closed after a fresh metadata-suppressed commit
  file-list inspection rendered only the five expected repository paths.

## Recurrence history

- 2026-07-29T02:28:51.410643Z: First observed.
- 2026-08-02T17:24:30.5355902Z: Recurred when Task 1 post-commit inspection
  requested the full commit header and rendered the local author email. The
  output was contained to local tooling; no external system was contacted, and
  remaining Git inspection switches to metadata-free formats.
