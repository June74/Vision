# SB-20260727-052025-setback-helper-absent: Setback helper was absent

- **Status:** closed
- **First observed:** 2026-07-27T05:20:25Z
- **Last observed:** 2026-07-28T02:01:36.2087445Z
- **Phase/task:** Preview database role probe Task 1
- **Environment:** Local Phase B worktree
- **Version/commit:** `80e8c3e`

## Symptom

The setback skill referenced a repository helper that this repository does not
contain.

## Impact

The read-only lookup failed. No provider, credential, repository content, or
runtime state changed; incident creation was delayed briefly.

## Reproduction conditions

Attempt to read the optional helper before confirming that it exists in this
repository.

## Safe evidence

The filesystem reported that the repository-relative helper path was absent.

## Attempts and outcomes

- The helper lookup failed because the file does not exist.
- The established incident template and index format were used directly.
- The recurrence again confirmed that the repository-relative helper path is
  absent. A narrowed lookup found the maintained helper under the setback
  skill root, and that helper created the new incident successfully.
- A broad recursive lookup crossed an unrelated missing package subpath before
  the search was narrowed to the operations and skill directories.
- The index link contained a timestamp suffix that was absent from this
  incident's filename; the link was corrected to the existing file.

## Cause classification

- **Confirmed cause:** This repository has no setback-creation helper.
- **Hypotheses:** None.
- **Rejected hypotheses:** Filesystem permissions were not involved.
- **Known exclusions:** No secret, provider value, or protected data was read
  or written.

## Correction and prevention

- **Correction:** Use the maintained helper from the setback skill root, or
  create incidents from the established repository template when unavailable.
- **Prevention:** Resolve the helper relative to the fully read skill instead
  of assuming a repository-relative path, and keep index links aligned with
  existing incident filenames.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

Both this incident and the triggering browser incident were indexed without
using the absent helper.

The recurrence used the maintained skill helper successfully, and the index
link now resolves to this existing incident.

## Recurrence history

- 2026-07-27T05:20:25Z: First observed and closed with the template fallback.
- 2026-07-27T23:45:03.8237805Z: Recurred when the repository-relative helper
  path was invoked before resolving it against the setback skill root. The
  skill helper then created the required provider-navigation incident. A
  narrowed lookup avoided the unrelated package-directory gap, and the stale
  index link was corrected. No provider or database state changed.
- 2026-07-28T02:01:36.2087445Z: Recurred when the repository-relative helper
  path was invoked while recording the skill-root setback. The established
  incident and index formats were used directly; no provider, repository
  runtime, or private state changed.
