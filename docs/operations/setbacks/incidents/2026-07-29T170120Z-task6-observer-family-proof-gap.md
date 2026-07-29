# SB-20260729-170120-task6-observer-family-proof-gap: Observer proof did not bind the evidence family

- **Status:** closed
- **First observed:** 2026-07-29T17:00:45Z
- **Last observed:** 2026-07-29T17:02:34Z
- **Phase/task:** Phase B acceptance instrumentation Task 6 self-review
- **Environment:** Local Phase B linked worktree
- **Version/commit:** `1c7f89b`

## Symptom

Candidate deployment verified an in-progress observer job at the same commit,
but did not prove that its selected safe-tail evidence family matched the
foundation, AI, or fault candidate being deployed.

## Impact

An operator could accidentally cite a running maintenance observer as proof for
a foundation, AI, or fault candidate. The observer remained non-mutating and
privacy-safe, but it would not capture the intended terminal record. No live
workflow or provider state was changed.

## Reproduction conditions and safe evidence

The proof queried the workflow run and job list, then accepted the fixed
`Capture one safe scheduled outcome` job name without comparing the candidate
operation to the observer evidence family.

## Attempts and outcomes

- Static workflow self-review found the missing binding before commit.
- Existing tests proved run ID, immutable SHA, and in-progress state but did not
  assert the family match.

## Cause classification

- **Confirmed cause:** The proof contract stopped at observer liveness instead
  of matching its resolved job name to the candidate family.
- **Hypotheses:** None.
- **Rejected hypotheses:** The selector builder and safe-tail classifiers do
  not widen the evidence vocabulary.
- **Known exclusions:** No live run, secret, migration, or evidence schema
  changed.

## Correction and prevention

- **Correction:** Give the observer job a family-resolved name, derive the
  expected family from the candidate operation, and require the exact running
  job name in the GitHub API response.
- **Prevention:** Workflow proof tests must cover identity, commit, liveness,
  and purpose rather than liveness alone.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Add a RED workflow assertion before changing the
  workflow.

## Verification and related work

The new workflow assertion failed before implementation, then all 10 workflow
tests passed after exact family matching was added.
