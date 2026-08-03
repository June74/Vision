# SB-20260803-191214-xdg-override-hid-wrangler-auth: Task-local XDG override hid normal Wrangler authentication

- **Status:** resolved
- **First observed:** 2026-08-03T19:12:14.658595Z
- **Last observed:** 2026-08-03T19:12:14.658595Z
- **Phase/task:** Phase B corrected redeploy read-only validation
- **Environment:** Local Windows PowerShell 5.1 controller using saved Wrangler authentication
- **Version/commit:** Task 2 read-only validation

## Symptom

The read-only launcher set XDG_CONFIG_HOME to an in-worktree diagnostic folder; plain Wrangler whoami can still exit zero unauthenticated, while deployments list then exited without stdout.

## Impact

Read-only validation was delayed, but no deployment or provider mutation occurred.

## Reproduction conditions

Launch the read-only controller with a task-local `XDG_CONFIG_HOME` override,
then compare the behavior with a no-override launch using normal saved Wrangler
authentication. Plain `whoami` exit status alone is not authentication proof.

## Safe evidence

- The XDG-overridden run could not advance through the read-only validation.
- Plain `whoami` returned a false-positive exit status despite unavailable
  saved authentication.
- The no-override run accepted a fresh schedule challenge and completed with
  a sanitized successful read-only outcome.
- No credentials, provider payloads, identifiers, or provider mutations were
  recorded.

## Attempts and outcomes

1. The original task-local XDG override isolated the controller from normal
   saved Wrangler authentication.
2. Plain `whoami` exit status was rejected as an authentication proof because
   it can return a false-positive success.
3. The controller was re-launched without an XDG override and completed the
   fresh nonce-bound schedule confirmation path successfully.

## Cause classification

- **Confirmed cause:** The task-local XDG override hid normal saved Wrangler
  authentication; plain `whoami` exit behavior was a false-positive indicator.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** A zero exit status from plain `whoami` proves saved
  Wrangler authentication is available.
- **Known exclusions:** No deployment, schedule change, other provider
  mutation, credential output, or secret output occurred.

## Correction and prevention

- **Correction:** Re-ran the read-only controller with no XDG override.
- **Prevention:** Never set XDG overrides for normal saved Wrangler
  authentication; require an operation-specific safe result rather than plain
  `whoami` exit status as authentication evidence.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None for this incident.

## Verification and related work

The no-override re-run reached and accepted a fresh schedule challenge and
reported `current_rollback_valid: true` through the sanitized outcome decoder.

## Recurrence history

- 2026-08-03T19:12:14.658595Z: First observed.
- 2026-08-03: No-override read-only validation completed successfully;
  incident resolved.
