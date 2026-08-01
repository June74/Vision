# SB-20260731-195605-task4-agent-orchestration-syntax: Task 4 diagnostics review mixed PowerShell into JavaScript orchestration

- **Status:** closed
- **First observed:** 2026-07-31T19:56:05.9881048Z
- **Last observed:** 2026-07-31T22:59:20.5223522Z
- **Phase/task:** Phase B Tasks 4 and 5 agent orchestration
- **Environment:** Read-only subagent tool orchestration
- **Version/commit:** 2cf0ff1

## Symptom

The diagnostics review subagent placed PowerShell array syntax in a JavaScript
orchestration snippet. JavaScript parsing failed before any nested tool ran.

## Impact

No file, provider, environment, network, secret, staging state, or commit
changed. The read-only review paused until the error was recorded.

## Cause classification

- **Confirmed cause:** Two command-language syntaxes were mixed at the
  orchestration boundary.
- **Hypotheses:** None remaining.
- **Known exclusions:** No nested shell command executed.

## Correction and prevention

- **Correction:** Use valid JavaScript arrays or direct `Promise.all` calls in
  orchestration, keeping PowerShell syntax inside shell-command strings.
- **Prevention:** Validate the outer language before embedding an inner shell
  command.
- **Owner:** Codex diagnostics review subagent.
- **Next diagnostic step:** None; resume with valid JavaScript orchestration.

## Recurrence history

- 2026-07-31T19:56:05.9881048Z: Observed, contained, and closed before any
  nested tool execution.
- 2026-07-31T22:14:54.1781132Z: Recurred when the Task 5 browser reviewer
  requested a 1,280-millisecond agent wait below the 10,000-millisecond
  minimum. Validation rejected it before any wait or state change.
- 2026-07-31T22:19:52.1664250Z: Recurred when the root attempted to spawn the
  scheduled-package reviewer while four team threads still occupied the
  concurrency tree. The dispatch was rejected before review work or mutation;
  independent review waits for a repair lane to finish.
- 2026-07-31T22:21:30.0858749Z: Recurred when the scheduled reviewer supplied
  `timeout` instead of the required `timeout_ms` field to the agent wait tool.
  Schema validation rejected the call before execution or state change.
- 2026-07-31T22:59:20.5223522Z: Recurred when the Task 6 safe-runner reviewer
  was dispatched just before the implementation lane's final completion freed
  a team slot. The dispatch was rejected before review or mutation and is
  retried only after formal lane completion.
