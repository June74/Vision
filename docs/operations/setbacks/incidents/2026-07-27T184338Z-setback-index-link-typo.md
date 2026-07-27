# SB-20260727-184338-setback-index-link-typo: Incident index link was mistyped during recurrence update

- **Status:** closed
- **First observed:** 2026-07-27T18:43:38Z
- **Last observed:** 2026-07-27T18:43:38Z
- **Phase/task:** Phase B restore Task 4 setback logging
- **Environment:** Local repository documentation
- **Version/commit:** Uncommitted live-acceptance evidence update

## Symptom

A recurrence edit omitted the timestamp suffix from one incident link in the
setback index.

## Impact

The uncommitted index briefly pointed at a nonexistent local path. Runtime,
provider, database, credential, and deployment state were unaffected.

## Reproduction conditions

Manually rewrite an existing incident row without copying its exact path.

## Safe evidence

The index target did not match the existing incident filename. No private
value or provider-controlled content was involved.

## Attempts and outcomes

- The typo was detected immediately in the applied patch result.
- The exact existing filename was restored before any commit or push.

## Cause classification

- **Confirmed cause:** The existing filename was transcribed instead of copied
  exactly.
- **Hypotheses:** None.
- **Rejected hypotheses:** The incident file itself was present and unchanged.
- **Known exclusions:** No live or secret state changed.

## Correction and prevention

- **Correction:** Restore the exact indexed filename.
- **Prevention:** Copy existing incident paths verbatim and run documentation
  coverage before committing every setback update.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected index resolves to the existing incident; the full documentation
check remains required before commit.

## Recurrence history

- 2026-07-27T18:43:38Z: First observed and corrected before commit.
