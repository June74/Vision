# SB-20260803-200702-fix-brief-omitted-setback-index: Final-review fix brief omitted the setback index

- **Status:** resolved
- **First observed:** 2026-08-03T20:07:02.818512Z
- **Last observed:** 2026-08-03T20:18:34.5600855Z
- **Phase/task:** Phase B TSX repair final-review fix
- **Environment:** Local documentation-only INDEX-scope reconciliation in the Phase B worktree
- **Version/commit:** Reconciliation `2e3e8de`; broad index follow-up `e7fa130`; narrow repair pending commit

## Symptom

The first follow-up authorized the helper-managed index but staged the entire
pre-dirty aggregate `INDEX.md`; it also retained stale `open` statuses for
eight required TSX-repair rows.

## Impact

The first follow-up committed `148` added and `46` removed INDEX lines from
`2e3e8de` to `e7fa130` rather than the nine task-local rows. No application,
controller, provider, credential, database, calendar, or key state changed.

## Reproduction conditions

Stage a helper-managed aggregate ledger that was already dirty without first
isolating the authorized rows against a recorded base snapshot.

## Safe evidence

- The verified net INDEX scope from `2e3e8de` to `e7fa130` is `148` additions
  and `46` removals.
- Eight of the nine required rows were `open` despite their incident headers
  recording six `resolved`, one `contained`, and one additional `resolved`
  reconciliation incident.
- Immutable base and broad snapshots were hash-verified before reconstruction.
- No application, controller, provider, credential, database, calendar, or
  key state changed.

## Attempts and outcomes

1. Commit `2e3e8de` correctly contained the Task 2 reconciliation incident and
   stale-impact correction, but no helper-managed index row.
2. Commit `e7fa130` addressed the missing authorization but swept unrelated
   pre-dirty ledger work into its INDEX diff.
3. Final re-review identified the broad `148`-addition/`46`-removal scope and
   the eight stale row statuses.
4. Snapshot-based reconstruction produced exactly nine header-derived rows and
   a `9`-addition/`0`-removal explicit base comparison; documentation and
   whitespace checks passed before staging.

## Cause classification

- **Confirmed cause:** The fix wave treated a helper-managed pre-dirty
  aggregate ledger as if it were a task-local two-line change.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The broad aggregate INDEX content consisted only of
  the nine authorized Task 2 rows.
- **Known exclusions:** No application, controller, provider, credential,
  database, calendar, key, or test state changed.

## Correction and prevention

- **Correction:** Reconstructed the committed INDEX from the `2e3e8de` snapshot
  plus exactly nine header-derived rows; the post-commit step restores every
  unrelated broad change to the working tree without altering those nine rows.
- **Prevention:** Snapshot aggregate ledgers before staging, compute path-level
  and line-level scope against the recorded base, and never stage a pre-dirty
  aggregate file without isolating the authorized rows.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while resolved; preserve the committed and
  restored working-tree invariants in the final verification record.

## Verification and related work

Both immutable snapshot hashes matched the manifest. The pre-stage narrow
INDEX had one matching header-derived row for each required incident and an
explicit base comparison of `9` additions and `0` removals; documentation and
whitespace checks passed. The commit and post-commit dirty-ledger restoration
remain the final verification record for this resolved recurrence.

## Recurrence history

- 2026-08-03T20:07:02.818512Z: First observed.
- 2026-08-03T20:07:02.818512Z: Resolved after the scoped index follow-up was
  prepared with no runtime or provider action.
- 2026-08-03T20:16:23.1770675Z: Recurred when final re-review proved that the
  authorized index follow-up swept unrelated pre-dirty ledger content and
  retained eight stale row statuses; contained pending narrow reconstruction.
- 2026-08-03T20:18:34.5600855Z: Pre-stage snapshot, row-contract, scope,
  documentation, and whitespace verification passed; resolved pending the
  commit-scope and post-commit restoration record.
