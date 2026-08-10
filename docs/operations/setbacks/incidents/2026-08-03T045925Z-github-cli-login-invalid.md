# SB-20260803-045925-github-cli-login-invalid: Local GitHub CLI login was invalid

- **Status:** contained
- **First observed:** 2026-08-03T04:59:25.5969678Z
- **Last observed:** 2026-08-03T04:59:25.5969678Z
- **Phase/task:** Phase B fresh AI Gateway rule verification
- **Environment:** Local GitHub CLI
- **Version/commit:** Candidate `c1911f8`; candidate not deployed

## Symptom

A read-only authentication status check reported that the locally saved GitHub
CLI login is invalid, so the protected preview workflow cannot be dispatched
from this terminal.

## Impact

Fresh automated Gateway identity/rule verification cannot use the local CLI.
No workflow, deployment, provider mutation, credential change, or key change
occurred.

## Safe evidence

Only the fixed authentication failure and active account label were displayed.
No token or credential value was printed or retained.

## Cause classification

- **Confirmed cause:** The GitHub CLI's existing authentication is no longer
  valid.
- **Known exclusions:** Repository identity, candidate commit, and workflow
  source remain present locally.

## Correction and prevention

- **Correction:** Use the already authenticated provider dashboard for the
  immediate read-only rule check; do not interrupt Phase B to repair an
  unrelated CLI login.
- **Prevention:** Check CLI authentication before designing an operator path
  around it, and retain a dashboard read-only fallback.
- **Owner:** Codex and project owner.

## Verification and related work

The failure occurred before any dispatch request. Incident remains contained
until the CLI is repaired or the dashboard proof supersedes the need for it.

## Recurrence history

- 2026-08-03T04:59:25.5969678Z: First observed and contained before mutation.
