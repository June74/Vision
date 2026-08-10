# SB-20260803-002144-corrected-redeploy-precondition-failed: Corrected redeploy dry run failed a grouped precondition

- **Status:** closed
- **First observed:** 2026-08-03T00:21:44.7907595Z
- **Last observed:** 2026-08-03T00:36:28.2471845Z
- **Phase/task:** Phase B OAuth reconnect Task 5 corrected candidate retry
- **Environment:** Local artifacts plus read-only rolled-back preview validation
- **Version/commit:** Candidate `c1911f8`; rollback `94b8810`

## Symptom

The corrected redeploy controller's read-only current-rollback mode exited one
with the fixed category `precondition_failed`.

## Impact

The controller stopped before deployment. No Worker version, provider setting,
schedule, binding, Google state, database state, credential, calendar, or key
changed.

## Reproduction conditions

Run the syntax-valid ignored controller in current-rollback validation mode
while its first implementation groups artifact, evidence, authentication,
active-version, and live-state checks under one stage category.

## Safe evidence

Only the fixed precondition category and false acceptance/rollback Booleans
were returned. No URL, provider identifier, response body, binding value,
credential, account data, or raw log was rendered or retained.

## Attempts and outcomes

- Syntax validation passed with zero parser errors.
- The first read-only live dry run failed before any mutation.
- Narrowed staging classified the failure as `candidate_artifact_invalid`.
- A Boolean-only launcher check proved the local Wrangler launcher and preview
  config exist, the system `pnpm.cmd` is available, and a local
  `node_modules/.bin/pnpm.cmd` does not exist.
- After the launcher correction, narrowed staging reached
  `active_version_state_invalid`; the same read-only Wrangler queries then
  passed when issued explicitly, while the wrapper returned
  `wrangler_json_query_failed`.
- A bounded read of the prior reserved-argument incident confirmed the wrapper
  parameter name collides case-insensitively with PowerShell's automatic
  `$args` variable.
- The first local patch attempt made no change because one expected context
  hunk was absent. The incomplete patch was discarded and the exact remaining
  occurrences were enumerated before retrying.
- After the exact rename, parser validation reported zero errors and no
  reserved argument-name occurrences remained.
- The corrected controller then passed artifact and active-version gates and
  returned the precise separate provider-state category. That live
  configuration gap is tracked independently.

## Cause classification

- **Confirmed causes:** The artifact validator incorrectly assumed pnpm
  installs its own launcher under each artifact's `node_modules/.bin`; this
  repository deliberately invokes the available system `pnpm.cmd`. Its native
  wrappers also named their argument-list parameter `$Arguments`, which
  collides case-insensitively with PowerShell's reserved `$args` variable and
  empties the intended Wrangler arguments.
- **Hypotheses:** None remaining for the currently observed failures.
- **Rejected hypotheses:** Deployment and Google callback failure; neither was
  attempted. The candidate config and local Wrangler launcher are not missing.
- **Known exclusions:** No repository, provider, database, calendar, credential,
  or key mutation occurred.

## Correction and prevention

- **Correction:** Resolve `pnpm.cmd` through the system command lookup while
  keeping the artifact working directory exact, and rename wrapper argument
  parameters to the task-specific `$CommandArguments`.
- **Prevention:** Fail-closed operational controllers must classify each
  external boundary separately before their first live use.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed; continue through the separate
  missing-provider-bindings incident.

## Verification and related work

The corrected controller parsed cleanly, retained all tracked candidate and
rollback invariants, reached the live provider-state boundary with approved
network access, and reported only a fixed safe category.

## Recurrence history

- 2026-08-03T00:21:44.7907595Z: First read-only dry-run failure observed and
  contained before deployment.
- 2026-08-03T00:27:24.2742052Z: Diagnosis reached the reserved automatic
  variable collision. An over-broad local patch context failed without making
  changes; exact occurrences were enumerated for the correction.
- 2026-08-03T00:36:28.2471845Z: Closed after the exact rename and system pnpm
  lookup allowed the controller to complete every local precondition and
  reach the independently tracked live provider-binding boundary.
