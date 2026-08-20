# SB-20260818-170456 — GitHub CLI preview admission authentication

- Status: contained
- Detected at: 2026-08-18T17:04:56Z
- Last observed at: 2026-08-20T01:13:49Z
- Scope: Phase C preview deployment admission

## What happened

The read-only `gh auth status` check reported that the stored `June74` GitHub CLI token is invalid. The local Phase C branch is clean, but the GitHub push and workflow-dispatch steps cannot authenticate.

## Recurrence

On 2026-08-20T01:13:49Z, the same read-only `gh auth status` check again
reported an invalid stored `June74` credential. The connected GitHub account
has repository push permission, but the local CLI cannot push or dispatch the
preview workflow until its browser-based credential is renewed.

## Impact

No branch was pushed, no workflow was dispatched, and no preview or production deployment state changed.

## Root cause

The local GitHub CLI credential expired or was revoked outside the repository.

## Corrective action

Re-authenticate GitHub CLI through its browser flow with repository and workflow access, then rerun the read-only status check before pushing or dispatching.

## Next step

The user must run the documented `gh auth login` browser flow in the project terminal. Codex will then push only `codex/phase-c-write-pipeline` and dispatch the guarded normal preview operation.
