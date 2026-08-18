# SB-20260818-171543 — Phase C preview admission selection failure

- Status: open
- Detected at: 2026-08-18T17:15:43Z
- Last observed at: 2026-08-18T17:15:43Z
- Scope: Phase C disposable preview deployment admission
- Environment: GitHub Actions preview workflow; reviewed branch `codex/phase-c-write-pipeline`
- Reviewed commit: `b08484987a55abdd8863333d25a05282fb3cb32c`

## What happened

The user reported that the GitHub Actions job named `Admit one preview operation` completed with exit code 1. The run-level exit code does not identify the failing step or its message.

## Impact

The admission boundary failed before the normal preview deployment could be accepted. No production deployment was authorized. The exact provider-state impact remains to be verified from the run's job summary; no local or database mutation was performed by this investigation.

## Evidence

- The workflow defines `Admit one preview operation` as the `selection` job.
- Its validation step is `Verify exact acceptance operation`, which validates the operation, canonical context, dispatch SHA, and checked-out SHA.
- The local terminal cannot currently retrieve the run: `gh auth status` reports the stored GitHub CLI credential as invalid, and the sandbox blocks direct GitHub API access.
- The user has not yet supplied the run ID or the failed-step log.

## Attempts and outcomes

1. Read-only local `gh auth status`: failed because the stored GitHub CLI credential is invalid.
2. Read-only `gh run list`: failed before retrieval because GitHub API access is unavailable in this terminal.
3. Local workflow inspection: confirmed the admission job and its validation boundary; no fix attempted.

## Confirmed cause

The run concluded unsuccessfully at or within the admission job. The underlying cause is not confirmed until the failed step's safe log message is captured.

## Hypotheses

- The canonical `acceptance_context` may not have matched the reviewed commit or exact key contract.
- The workflow may have checked out a SHA different from the context's `reviewedCommit`.
- A dependency installation or runner-level step in the admission job may have failed before validation.

## Rejected hypotheses

- No code defect has been established.
- No database privilege or migration defect has been established; the admission job precedes application runtime proof.

## Correction and prevention

Do not rerun the operation yet. Retrieve the run's job and failed-step log first, then test one root-cause hypothesis at a time. Keep the preview-only boundary and the hardline of no more than 20 agents at once; no production operation is permitted.

## Owner and next diagnostic step

Owner: Codex with the user providing the GitHub run evidence.

Next step: open the failed run in GitHub, or run `gh run view <run-id> --log-failed` after authenticating GitHub CLI, and provide the safe failure message from `Verify exact acceptance operation` or the step that actually failed. Do not paste tokens, cookies, database URLs, or full private request payloads.
