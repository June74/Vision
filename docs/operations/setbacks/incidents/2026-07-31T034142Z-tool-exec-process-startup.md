# SB-20260731-034142-tool-exec-process-startup: Combined helper failed at Windows process startup

- **Status:** closed
- **First observed:** 2026-07-31T03:41:42.1841609Z
- **Last observed:** 2026-07-31T03:41:42.1841609Z
- **Phase/task:** Phase B live-acceptance closure setback logging
- **Environment:** Local managed Windows sandbox
- **Version/commit:** 00cd3c7 plus uncommitted setback ledger

## Symptom

A combined helper call failed before either child command started because the
Windows sandbox could not create the process under its logon wrapper.

## Impact

One read-only timestamp/search attempt did not run. No file, Git, provider,
network, browser, environment, or external state changed.

## Reproduction conditions

Invoke two otherwise valid read-only shell commands through the combined helper
while its Windows process wrapper is unavailable.

## Safe evidence

The helper returned only a process-startup failure category and operating-system
error code. It emitted no command result, protected value, or external data.

## Attempts and outcomes

- The combined helper failed before execution.
- The same timestamp and index search succeeded immediately as separate direct
  shell calls.

## Cause classification

- **Confirmed cause:** Transient combined-helper process creation failure in
  the managed Windows sandbox.
- **Hypotheses:** None retained after the direct replacement succeeded.
- **Rejected hypotheses:** The repository and commands were not the cause.
- **Known exclusions:** No product or provider action occurred.

## Correction and prevention

- **Correction:** Use separate direct shell calls for this logging step.
- **Prevention:** Do not retry a failed combined helper unchanged; reduce it to
  the smallest direct calls first.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

Both replacement direct calls completed successfully.

## Recurrence history

- 2026-07-31T03:41:42.1841609Z: First observed and closed after direct-call
  verification.
