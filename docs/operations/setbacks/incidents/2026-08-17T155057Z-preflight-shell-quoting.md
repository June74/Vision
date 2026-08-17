# SB-20260817-155057 — Phase C preflight shell quoting

- Status: contained
- Detected at: 2026-08-17T15:50:57Z
- Scope: Phase C disposable Neon target read-only preflight

## What happened

The first one-off Node preflight command was passed through PowerShell with an incorrectly escaped JavaScript template literal. Node stopped with a syntax error before opening a database connection. The surrounding PowerShell command then removed the temporary credential file as intended.

## Impact

No database request, migration, deployment, or provider state change occurred. The credential value was not printed.

## Root cause

The command boundary treated the backtick used by the Neon tagged query as PowerShell syntax instead of preserving it for Node.

## Corrective action

The next attempt will use a quoting-safe JavaScript invocation that does not contain a PowerShell-interpreted template literal. The read-only query and redacted output boundary remain unchanged.

## Next step

Rerun the read-only preflight after recreating the temporary URL file if cleanup removed it.
