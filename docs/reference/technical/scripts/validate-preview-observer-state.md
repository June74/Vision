# `scripts/validate-preview-observer-state.ts`

Binds a candidate deployment to one workflow-dispatch run at the verified
commit and to the exact evidence-family job. It rejects queued, completed,
cancelled, absent, or duplicated listener steps.

## `PreviewObserverEvidence`

Provides the closed evidence-family union shared by the validator and CLI.

## `PreviewObserverState`

Carries untrusted run and jobs data with the expected commit and evidence.

## `validatePreviewObserverState`

Checks event, workflow path, commit, run state, unique job identity, unique
step identity, and active status without rendering provider responses.

## `plainObject`

Rejects arrays, null, and custom prototypes at untrusted JSON boundaries.

## `readResponse`

Enforces the response-size ceiling before parsing JSON.

## `parseArguments`

Rejects unknown, missing, empty, or duplicate flags and invalid evidence.

## `main`

Loads bounded files, runs the closed validator, and maps every failure to one
non-sensitive terminal message.
