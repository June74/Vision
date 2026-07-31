# SB-20260731-020429-task3-restore-integration-suite-fallout: Task 3 restore facade move caused two integration-suite failures

- **Status:** closed
- **First observed:** 2026-07-31T02:04:29.764267Z
- **Last observed:** 2026-07-31T02:10:48.4061973Z
- **Phase/task:** Phase B Task 3 isolated restore repair
- **Environment:** Isolated restore-contract worktree; focused six-file Vitest group
- **Version/commit:** 2bfbc23f13c44e60b01bbffcecc9748d322765b5 plus restore façade/scheduler repair

## Symptom

The focused six-file restore, scheduled, and security suite returned two sanitized failure tokens after the public facade move.

## Impact

Restore integration verification paused while the smaller runtime and compiler checks remain green; no provider, live, protected, or external state changed.

## Reproduction conditions

Run the focused restore, scheduled-job, and security suite after moving the
production restore entry point behind the frozen public runtime façade.

## Safe evidence

The sanitized runner returned two failure tokens and no source text, URI,
identifier, proof, protected value, or runtime stream.

## Attempts and outcomes

- The narrow runtime test and both source/test compiler checks passed first.
- The broader six-file integration group then isolated two remaining failures.
- Exact-file diagnosis reduced the fallout to one security inventory assertion.

## Cause classification

- **Confirmed cause:** The new tracked boundary test is itself a temporary
  acceptance-surface residue, so the security inventory needed that exact path
  and the shared-residue cardinality needed to increase by one.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** TypeScript, the narrow runtime behavior, provider
  state, network, backup key, live request, and protected data are unaffected.

## Correction and prevention

- **Correction:** Add the exact new boundary-test path to the temporary-surface
  security inventory and increment only the corresponding shared-residue
  cardinality.
- **Prevention:** After an exported façade move, run the full import/consumer
  test group immediately after the first narrow GREEN.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; continue static gates and isolated commit.

## Verification and related work

The dedicated security test passed, followed by all 48 tests in the six-file
restore, scheduled, and security group.

## Recurrence history

- 2026-07-31T02:04:29.764267Z: First observed.
- 2026-07-31T02:10:48.4061973Z: Closed after the new test path and one-count
  residue increase aligned the security inventory; 6 files and 48 tests passed.
