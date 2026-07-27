# SB-20260727-052025-setback-helper-absent: Setback helper was absent

- **Status:** closed
- **First observed:** 2026-07-27T05:20:25Z
- **Last observed:** 2026-07-27T05:20:25Z
- **Phase/task:** Phase B restore Task 4 setback logging
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

## Cause classification

- **Confirmed cause:** This repository has no setback-creation helper.
- **Hypotheses:** None.
- **Rejected hypotheses:** Filesystem permissions were not involved.
- **Known exclusions:** No secret, provider value, or protected data was read
  or written.

## Correction and prevention

- **Correction:** Create incidents from the established repository template.
- **Prevention:** Check helper existence before invoking it; use the template
  fallback when absent.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

Both this incident and the triggering browser incident were indexed without
using the absent helper.

## Recurrence history

- 2026-07-27T05:20:25Z: First observed and closed with the template fallback.
