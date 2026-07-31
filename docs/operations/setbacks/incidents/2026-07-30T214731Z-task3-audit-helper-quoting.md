# SB-20260730-214731-task3-audit-helper-quoting: Task 3 audit helper had a pre-execution quoting error

- **Status:** closed
- **First observed:** 2026-07-30T21:47:31.115876Z
- **Last observed:** 2026-07-31T02:16:13.3828851Z
- **Phase/task:** Phase B live-acceptance closure Task 3 repair audit
- **Environment:** Read-only Task 3 controller/workflow audit
- **Version/commit:** `38bed3e991d5bfb40b1452bd955634e30247c045`

## Symptom

A sanitized read-only inspection helper failed to parse because its command quoting was invalid.

## Impact

The helper did not execute and briefly delayed the audit; no file, protected value, provider, or external state was affected.

## Reproduction conditions

Invoke the one-off sanitized inspection helper with its original invalid
PowerShell quoting.

## Safe evidence

The parse failure occurred before execution and returned only a syntax
category.

## Attempts and outcomes

- The malformed helper did not execute.
- The audit stopped that command path and switched to already validated
  sanitized readers.

## Cause classification

- **Confirmed cause:** Invalid quoting in the one-off inspection command.
- **Hypotheses:** None.
- **Rejected hypotheses:** No repository or tool defect caused the failure.
- **Known exclusions:** No command body, mutation, provider, network, protected
  value, or external state was reached.

## Correction and prevention

- **Correction:** Retire the malformed helper and use the existing sanitized
  exact-path readers.
- **Prevention:** Prefer previously validated inspection commands to new nested
  quoting. Do not use inline Node/TypeScript inspection commands in the
  remaining Task 3 repair, including one-off JavaScript summary helpers;
  express executable checks as bounded test files or use existing known-good
  test structures.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The malformed helper was not retried and the audit proceeded through sanitized
readers.

## Recurrence history

- 2026-07-30T21:47:31.115876Z: First observed.
- 2026-07-30T22:30:21.4901196Z: Recurred when a read-only controller-boundary
  review wrapper had invalid JavaScript quoting. Parsing failed before any
  nested command ran; no file, protected value, provider, network, or external
  state was reached. The reviewer was restricted to direct literal reads.
- 2026-07-31T01:40:17.6700895Z: Recurred when a read-only worktree preflight
  passed an unquoted Git peel expression through PowerShell. Git rejected the
  malformed arguments before reading the object; no branch, worktree, file,
  provider, or external state changed. The retry uses the literal full commit
  hash without peel syntax.
- 2026-07-31T01:49:29.5230865Z: The isolated restore writer's inline Node
  inspection was mangled by PowerShell quoting, causing a syntax failure and a
  local runtime assertion. The command was read-only and changed no file or
  external state. Inline runtime inspection is retired in favor of bounded
  compiler and test files.
- 2026-07-31T02:16:13.3828851Z: The isolated controller writer constructed a
  one-off JavaScript input-summary helper with a brace/syntax error. It did not
  run or print protected content and changed no state. The helper is retired;
  the lane must use the existing foundation test structure.
