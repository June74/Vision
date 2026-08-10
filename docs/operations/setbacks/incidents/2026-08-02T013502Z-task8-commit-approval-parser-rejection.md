# Approval request parser rejected an otherwise scoped local action

- **Occurred:** 2026-08-02T01:35:02.0156850Z
- **Last observed:** 2026-08-03T17:55:55.8743002Z
- **Status:** contained
- **Phase:** Phase B / tracked correlation repair through corrected redeploy read-only validation
- **Category:** external approval-system blocker

## What happened

The request to create the single reviewed Git commit was rejected before execution because the approval layer reported an invalid request-parameter parsing error. The Git command did not run.

## Impact

No commit, push, deployment, provider, database, calendar, credential, key, or live state changed. The 90 reviewed paths remain staged, but this required setback entry adds an unstaged ledger change and therefore invalidates the prior exact-tip verdict for publication.

## Corrective action

- Obtain explicit owner approval after explaining that the action writes only local Git commit metadata.
- Reconcile this ledger entry, rerun the bounded documentation/privacy freeze, and obtain a fresh exact-tip zero-finding verdict.
- Restage exactly the refreshed reviewed candidate before retrying the commit through the approved path.

## Prevention

Treat approval-layer parsing failures as pre-execution blockers, never retry them indirectly, and preserve a clear distinction between local Git metadata writes and live deployment or provider mutations.

## Recurrence history

- 2026-08-02T01:35:02.0156850Z: First observed before the reviewed Task 8
  commit; the command did not run.
- 2026-08-02T20:15:40.4735054Z: Recurred before recreating two exact disposable
  local worktrees with command-scoped LF checkout. The approval system reported
  an internal unknown request parameter and rejected the action before Git ran.
  The already-cleaned short paths remain absent; no source, commit, provider,
  database, credential, key, or deployment state changed. Explicit owner
  approval is required before the same action may be retried.
- 2026-08-02T20:24:28.5327327Z: The same explicit-approval condition remained
  unmet across the third consecutive goal continuation. A fresh read-only
  preflight proved both short targets absent and unregistered and the guarded
  recreation script syntax-valid. No retry, repository mutation, provider
  action, database access, credential access, or deployment occurred. The
  active goal is formally blocked until the owner replies with explicit
  approval for this local action.
- 2026-08-02T20:32:58.9396170Z: After the owner explicitly replied
  `approved`, the guarded recreation request was submitted once. The approval
  service again rejected it before execution with the same internal unknown
  request-parameter category. PowerShell and Git did not start; both target
  paths remain absent, and no repository, provider, database, calendar,
  credential, key, or deployment state changed. The service now requires a
  fresh owner approval after the local filesystem risk is stated explicitly.
- 2026-08-02T21:51:06.4925615Z: The owner then gave the exact requested
  risk-aware approval for creating and later permanently deleting only the two
  disposable local worktree directories. One guarded submission still failed
  inside the approval service with the same internal unknown request-parameter
  category before PowerShell or Git started. No workaround or indirect
  execution was attempted; repository and external state remain unchanged.
- 2026-08-02T22:00:31.9006270Z: Closed after the owner refreshed the task and
  explicitly requested the same approved retry. The approval path admitted the
  guarded script, which exited zero; independent verification then returned
  true for both exact commits, detached state, tracked cleanliness,
  containment, registration, and byte parity. No cloud or secret state was
  involved.
- 2026-08-03T16:42:58.4018684Z: Recurred while trying to run the new native
  timeout regression test outside the restricted sandbox. The approval service
  rejected both the diagnostic child-process probe and the exact test request
  before execution with its internal unknown-parameter category. The expected
  TDD failure remains established, no provider or repository state changed,
  and the next diagnostic step is a fresh owner approval for the exact local
  test after its child-process termination scope is stated.
- 2026-08-03T16:44:39.0405138Z: Recurred after the owner provided the exact
  risk-aware approval requested for the disposable child-process test. The
  approval service again rejected the request before PowerShell started. No
  child, network request, provider mutation, secret read, or repository change
  occurred. The contained fallback is direct owner execution of the exact
  local test and reporting only its safe final category.
- 2026-08-03T16:46:32.9550955Z: The owner ran the exact local regression test
  directly and reported `native_timeout_contract_ok`. This verifies the safe
  fallback and the controller's first timeout/cleanup contract, while the
  external approval-parser recurrence itself remains contained rather than
  fixed.
- 2026-08-03T17:55:55.8743002Z: Recurred before the corrected controller's
  read-only rollback validation could start. The request was limited to preview
  metadata and health reads with no deployment mode, but the approval service
  rejected its own internal request parameter before PowerShell launched. No
  process, network request, provider read/mutation, secret access, or live state
  change occurred. A fresh owner approval is required before one exact retry.
