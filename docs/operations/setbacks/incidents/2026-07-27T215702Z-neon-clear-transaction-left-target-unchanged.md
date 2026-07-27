# SB-20260727-215702-neon-clear-transaction-left-target-unchanged: Neon clear transaction left target unchanged

- **Status:** contained
- **First observed:** 2026-07-27T21:57:02.7647984Z
- **Last observed:** 2026-07-27T22:05:17.2075310Z
- **Phase/task:** Listener-first restore retry Task 2 history diagnosis
- **Environment:** Signed-in Neon SQL Editor on the disposable restore target
- **Version/commit:** `ca11c6c`

## Symptom

The exact reviewed serializable transaction was staged with an exact
4,166-character copy-back and run once. The editor eventually returned to a
terminal state without exposing either the required safe notice or a SQL error.
The separate read-only aggregate result showed that the target remained
unchanged.

## Impact

The disposable restore target was not cleared. The task stopped before any
retry, secret action, deployment, restore capture, or branch lifecycle action.

## Reproduction conditions

On the privately confirmed disposable non-primary branch, prove the restricted
role through the corrected accessibility and visible-value checks, stage the
exact reviewed transaction, verify exact copy-back, and activate the unique
Run control once.

## Safe evidence

- `role_proven=true`
- `transaction_attempted=true`
- `transaction_notice_observed=false`
- `sql_error_observed=false`
- `authoritative_table_count=29`
- `total_rows=51`
- `nonempty_tables=13`
- `event_rows=0`
- `post_clear_verified=false`
- `history_entry_found=true`
- `saved_query_character_count=2450`
- `saved_query_matches_4166=false`
- `saved_query_contains_begin=false`
- `saved_query_contains_do_block=false`
- `saved_query_contains_commit=false`
- `history_success_indicator=false`
- `history_error_indicator=false`
- `history_duration_present=false`
- `history_error_category=unknown`

No provider identifier, connection information, attestation value, row
content, credential, or private URL was returned or recorded.

## Attempts and outcomes

- The disposable branch was selected, non-primary, and not the normal preview
  primary branch.
- Exactly one `vision_app` option reported `aria-selected=true`; activation
  closed the menu and three visible exact selected-value nodes confirmed the
  role.
- The exact transaction copied back at 4,166 of 4,166 characters.
- The unique Run control was activated once and was never retried or canceled.
- The editor returned to its terminal Run state without the required safe
  notice or a visible SQL error.
- A separate exact 3,416-character read-only aggregate query returned one
  fixed-shape row proving the retained aggregate remained unchanged.
- A later read-only History inspection selected the transaction attempt by
  its position immediately before the aggregate check. The saved submission
  contained 2,450 characters and none of the transaction boundary markers.

## Cause classification

- **Confirmed cause:** The SQL Editor History entry proves that the submitted
  query boundary was only 2,450 characters, not the exact 4,166-character
  script. It contained no transaction `BEGIN`, no reviewed `DO` block, and no
  `COMMIT`. The Editor therefore submitted only a current statement or
  selection rather than the complete reviewed transaction.
- **Hypotheses:** The remaining distinction between current-statement and
  current-selection submission is not exposed by History.
- **Rejected hypotheses:** A successful or partial clear is disproved by the
  unchanged 29-table, 51-row, 13-nonempty, zero-event aggregate. A full-script
  submission is disproved by the saved History boundary.
- **Known exclusions:** No production or normal preview database was selected.
  No secret, deployment, restore capture, branch deletion, or second clear
  attempt occurred.

## Correction and prevention

- **Correction:** Stop fail-closed, retain the disposable target, and do not
  retry the transaction.
- **Prevention:** Require both the exact transaction notice and the separate
  zero-row aggregate before treating a provider clear as committed. Exact
  editor copy-back alone is insufficient: a future separately authorized
  execution must also prove that no partial selection/current-statement mode
  remains before Run.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None in this turn. Any future retry requires
  separate authorization and an execution-boundary proof that prevents
  statement/selection-only submission.

## Verification and related work

The independent result contained all five expected columns and one exact safe
data row with 29 authoritative tables, 51 total rows, 13 nonempty tables, and
zero event rows. The clear acceptance gate therefore failed closed.

The later read-only History check identified the submitted boundary exactly:
2,450 characters with none of the three full-transaction markers. History did
not expose a success indicator, error indicator, duration, or allowlisted
terminal error category.

## Recurrence history

- 2026-07-27T21:57:02.7647984Z: First observed and contained without retry.
- 2026-07-27T22:05:17.2075310Z: Read-only History inspection confirmed the
  partial submission boundary. No query was edited or run, no provider state
  changed, and the browser was finalized.
