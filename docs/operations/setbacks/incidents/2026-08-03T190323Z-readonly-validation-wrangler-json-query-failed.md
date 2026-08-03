# SB-20260803-190323-readonly-validation-wrangler-json-query-failed: Read-only rollback validation failed at Wrangler JSON query

- **Status:** resolved
- **First observed:** 2026-08-03T19:03:23.442750Z
- **Last observed:** 2026-08-03T19:10:01.5360007Z
- **Phase/task:** Phase B corrected redeploy read-only validation
- **Environment:** Preview read-only controller plus local Windows PowerShell 5.1 help probes
- **Version/commit:** candidate `c1911f8`; known-good rollback remains the last validated active state

## Symptom

The approved validate_current_rollback run exited before a fresh schedule challenge with safe failure_category wrangler_json_query_failed.

## Impact

No deployment or other provider mutation occurred. The task-local authentication
configuration had to be corrected before the read-only validation could be
re-run.

## Reproduction conditions

Run the controller in `validate_current_rollback` mode with a task-local
`XDG_CONFIG_HOME` override. The saved Wrangler authentication is unavailable to
that process, so the validation cannot advance to a fresh schedule challenge.

## Safe evidence

- The uniquely named result file was small, decoded as the expected sanitized
  shape, and reported only `wrangler_json_query_failed`.
- The paired stderr file was empty.
- The baseline challenge timestamp did not change, proving the run stopped
  before live schedule evidence.
- Local no-network help probes for both `deployments list` and `versions view`
  exited zero, produced output, and documented `--json`.

## Attempts and outcomes

1. The single approved read-only controller retry launched and exited without
   deployment or schedule challenge.
2. Local real-adapter `--help` probes ruled out absent commands and absent JSON
   flags without contacting the provider.
3. The approved live deployment-list probe returned exit-zero false,
   output-present false, and JSON-decodable false. The response, stderr, and
   provider identifiers were not emitted.
4. A second local help check confirmed `--name`, `--json`, and `--env` are all
   valid documented options for the installed command.
5. The no-override re-run accepted a fresh schedule challenge and, after the
   user-visible schedule confirmation was bound to it, produced the expected
   sanitized successful read-only result.

## Cause classification

- **Confirmed cause:** The task-local XDG override hid the normal saved
  Wrangler authentication, causing the generic query-failure boundary.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The installed Wrangler lacks either queried command
  or its JSON flag; the normal saved authentication is unavailable.
- **Known exclusions:** No candidate dispatch, rollback dispatch, provider
  mutation, schedule challenge, credential print, or secret output occurred.

## Correction and prevention

- **Correction:** Re-ran the controller without an XDG override, using normal
  saved Wrangler authentication, and completed the nonce-bound schedule gate.
- **Prevention:** Do not set an XDG override when normal saved Wrangler
  authentication is required. Operational query wrappers retain safe
  exit/output shape categories while discarding provider payloads.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None for this incident; any candidate deployment
  remains a separately authorized action.

## Verification and related work

The no-override controller re-run reached and accepted a fresh schedule
challenge, then reported `current_rollback_valid: true`. No provider mutation
occurred.

## Recurrence history

- 2026-08-03T19:03:23.442750Z: First observed.
- 2026-08-03T19:05:48.4298163Z: Local real-adapter help probes passed; narrowed
  the next diagnostic to one response-discarding read-only query.
- 2026-08-03T19:10:01.5360007Z: The approved probe returned all three booleans
  false; local option validation still passed, narrowing the next safe evidence
  to an in-memory stderr classification.
- 2026-08-03: No-override validation accepted a fresh schedule challenge and
  completed successfully without provider mutation; incident resolved.
