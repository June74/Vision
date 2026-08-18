# SB-20260818-171543 — Phase C preview admission selection failure

- Status: contained
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
- The local validator accepts the canonical context when the JSON reaches it intact.
- A direct Windows PowerShell 5.1 argument-vector probe showed that passing the JSON through `--raw-field "acceptance_context=..."` strips the embedded JSON quotes before a native executable receives the argument. The resulting `{version:...,kind:none,...}` value is not JSON and produces this exact validator failure.
- The failed run's shell version was not recorded, so the shell-transport cause is confirmed for Windows PowerShell 5.1 and is the leading explanation for this run.
- The user has not yet supplied the run ID or the failed-step log.

## Attempts and outcomes

1. Read-only local `gh auth status`: failed because the stored GitHub CLI credential is invalid.
2. Read-only `gh run list`: failed before retrieval because GitHub API access is unavailable in this terminal.
3. Local workflow inspection: confirmed the admission job and its validation boundary; no fix attempted.

## Confirmed cause

The admission context was rejected before deployment. The context schema and validator pass when the JSON is intact. Windows PowerShell 5.1 strips embedded JSON quotes when the context is passed as a native `gh --raw-field` argument, which makes the context invalid before GitHub receives it. This matches the observed failure message exactly if the dispatch was run from Windows PowerShell 5.1.

## Hypotheses

- If the dispatch was run from PowerShell 7 or another shell with intact native argument passing, the remaining hypothesis is a reviewed-commit mismatch.
- A dependency installation or runner-level step in the admission job may have failed before validation.

## Rejected hypotheses

- The canonical `none` context schema is not defective; the same shape passed the local validator with matching dispatch and checkout SHAs.
- No database privilege or migration defect has been established; the admission job precedes application runtime proof.

## Correction and prevention

The correction is to send the complete workflow input object through `gh workflow run --json` on standard input, or to run the command in PowerShell 7. Do not pass the JSON context as a Windows PowerShell 5.1 native `--raw-field` argument. Keep the preview-only boundary and the hardline of no more than 20 agents at once; no production operation is permitted.

## Owner and next diagnostic step

Owner: Codex with the user providing the GitHub run evidence.

Next step: push the documentation-only current branch tip, dispatch a fresh normal preview using the `--json` standard-input form, and verify that `Admit one preview operation` passes before looking at deployment. Do not paste tokens, cookies, database URLs, or full private request payloads.
