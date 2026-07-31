# SB-20260731-015526-task3-restore-tool-routing-error: Task 3 restore lane sent a collaboration payload to the shell tool

- **Status:** closed
- **First observed:** 2026-07-31T01:55:26.816567Z
- **Last observed:** 2026-07-31T01:55:26.816567Z
- **Phase/task:** Phase B Task 3 isolated restore repair
- **Environment:** Codex subagent tool-routing layer
- **Version/commit:** 2bfbc23f13c44e60b01bbffcecc9748d322765b5

## Symptom

A collaboration-message payload was accidentally submitted to the shell tool and failed schema validation before execution.

## Impact

The restore lane paused briefly; no command, file, provider, live, or protected state was reached.

## Reproduction conditions

Select the shell tool while constructing a collaboration-message payload.

## Safe evidence

The tool schema rejected the payload before a shell command existed. The
reported result contained only the validation category.

## Attempts and outcomes

- One malformed tool call was rejected.
- It was not retried through the shell.

## Cause classification

- **Confirmed cause:** The subagent selected the wrong tool recipient for its
  status message.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No command, file read/write, provider action, network
  request, protected value, or external state was reached.

## Correction and prevention

- **Correction:** Send future status updates only through the collaboration
  message tool.
- **Prevention:** Verify the recipient namespace before submitting a non-shell
  payload.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

Schema rejection proved the shell never executed.

## Recurrence history

- 2026-07-31T01:55:26.816567Z: First observed.
