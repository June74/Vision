# SB-20260817-161223 — Phase C owner clipboard handoff

- Status: contained
- Detected at: 2026-08-17T16:12:23Z
- Scope: Phase C disposable Neon owner-URL handoff

## What happened

The temporary owner credential file contained the PowerShell setup instructions rather than a PostgreSQL URL. The likely cause is that the instructions were copied after the Neon connection string, replacing the clipboard contents before `Get-Clipboard` ran.

## Impact

The local Neon client rejected the value as an invalid URL before opening a connection. No provider request, migration, deployment, or database state change occurred. The temporary file was removed.

## Root cause

The handoff depended on clipboard state remaining unchanged while the setup command was copied into PowerShell.

## Corrective action

The next handoff will first capture the URL into a PowerShell variable by manually typing the capture command while the Neon URL is still on the clipboard. Subsequent commands may then be pasted because the URL is already held in the variable.

## Next step

Recreate the owner file using the clipboard-safe two-stage command and rerun the local-only URL validation before any database request.
