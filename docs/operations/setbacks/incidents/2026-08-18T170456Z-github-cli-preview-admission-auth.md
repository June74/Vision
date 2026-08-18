# SB-20260818-170456 — GitHub CLI preview admission authentication

- Status: contained
- Detected at: 2026-08-18T17:04:56Z
- Scope: Phase C preview deployment admission

## What happened

The read-only `gh auth status` check reported that the stored `June74` GitHub CLI token is invalid. The local Phase C branch is clean, but the GitHub push and workflow-dispatch steps cannot authenticate.

## Impact

No branch was pushed, no workflow was dispatched, and no preview or production deployment state changed.

## Root cause

The local GitHub CLI credential expired or was revoked outside the repository.

## Corrective action

Re-authenticate GitHub CLI through its browser flow with repository and workflow access, then rerun the read-only status check before pushing or dispatching.

## Next step

The user must run the documented `gh auth login` browser flow in the project terminal. Codex will then push only `codex/phase-c-write-pipeline` and dispatch the guarded normal preview operation.
