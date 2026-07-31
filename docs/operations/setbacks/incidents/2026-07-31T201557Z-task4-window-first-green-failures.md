# SB-20260731-201557-task4-window-first-green-failures: Task 4 window first GREEN retained three failures

- **Status:** closed
- **First observed:** 2026-07-31T20:15:57.759798Z
- **Last observed:** 2026-07-31T20:50:37.5421139Z
- **Phase/task:** Phase B Task 4 workflow and window implementation
- **Environment:** Local Phase B worktree, repository-local Vitest wrapper
- **Version/commit:** c23e301 plus Task 4 working changes

## Symptom

The repository-local Vitest wrapper collected four focused files; two files passed and two files retained three failures.

## Impact

Implementation is not accepted; debugging remains local with no provider, network, database, or external mutation.

## Reproduction conditions

Run the four owned unit files after the first implementation pass.

## Safe evidence

The first run reported three local assertion failures. After correcting test fixtures that crossed permanent schedule bounds, the rerun reported one remaining controller assertion failure. No raw output or private values were retained.

## Attempts and outcomes

- Corrected AI context fixtures whose post-expiry rollback interval crossed a permanent quarter-hour tick.
- Reran all four files: three files passed and one controller assertion remained.

## Cause classification

- **Confirmed cause:** Two context fixtures correctly violated the new permanent-schedule rule. The remaining controller fixture reported a provider timestamp before the simulated local clock had reached it.
- **Hypotheses:** None active.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** Window generation, workflow inputs, and canonical context tests now pass.

## Correction and prevention

- **Correction:** Use the existing two-step observer fixture so the provider timestamp is not observed from the future.
- **Prevention:** Construct AI fixtures by checking both the evidence-minute inequalities and the post-expiry permanent-schedule interval.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; incident closed.

## Verification and related work

Pending.

## Recurrence history

- 2026-07-31T20:15:57.759798Z: First observed.
- 2026-07-31T20:17:58.3766486Z: Reduced from three failures to one after correcting permanent-schedule-crossing fixtures.
- 2026-07-31T20:19:26.9311954Z: Closed after the corrected four-file run passed all 201 tests with an empty error stream.
- 2026-07-31T20:42:30.9331862Z: Recurred during independent-review TDD when
  an intended daily-schedule boundary fixture was rejected earlier by the
  broader recovery-window rule. The result was not used as RED evidence;
  correction is a direct isolated assertion of the post-expiry schedule guard.
- 2026-07-31T20:50:37.5421139Z: Closed after the isolated exact-boundary
  regression passed in the 91-test affected suite.
