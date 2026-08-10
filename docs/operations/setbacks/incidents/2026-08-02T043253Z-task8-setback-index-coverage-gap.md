# SB-20260802-043253-task8-setback-index-coverage-gap: Setback index omitted an existing incident file

- **Status:** closed
- **First observed:** 2026-08-02T04:32:53.541913Z
- **Last observed:** 2026-08-02T04:32:53.541913Z
- **Phase/task:** Phase B Task 8 operational-record verification
- **Environment:** Local Phase B worktree documentation audit
- **Version/commit:** `e283410`

## Symptom

The incident-to-index consistency check found one existing incident file without a matching index row.

## Impact

Operational history was incomplete in the index; application, provider, database, and secret state were unaffected.

## Reproduction conditions

Run an exact filename comparison between every Markdown file in
`docs/operations/setbacks/incidents` and the links in
`docs/operations/setbacks/INDEX.md`.

## Safe evidence

The comparison returned 507 incident files and one filename without an index
link. Repository history showed that the tracked incident was added in a commit
that did not change the index.

## Attempts and outcomes

- Confirmed the incident file is tracked.
- Confirmed its creation commit did not change the index.
- Added the missing row and reran the exact filename comparison.

## Cause classification

- **Confirmed cause:** The earlier incident creation committed the incident
  file without updating the index.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The file was not an ignored draft or legacy-only
  record; Git tracks it under the indexed incident directory.
- **Known exclusions:** No application, deployment, provider, database, or
  secret state was involved.

## Correction and prevention

- **Correction:** Add the exact missing incident row to the index.
- **Prevention:** Run the incident-file-to-index filename comparison after
  every setback-ledger change and before candidate publication.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The exact comparison is rerun after the correction and must report zero missing
incident links.

## Recurrence history

- 2026-08-02T04:32:53.541913Z: First observed, traced to the creation commit,
  corrected, and closed after the exact filename comparison passed.
