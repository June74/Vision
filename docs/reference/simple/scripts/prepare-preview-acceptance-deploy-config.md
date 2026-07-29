# prepare-preview-acceptance-deploy-config

Builds one temporary preview acceptance deployment file from the already
validated normal preview file. The normal file is never edited.

The command accepts only one approved acceptance operation and its matching
fault choice. It adds one one-minute schedule and one exact temporary selector.
The AI evidence candidate also requires a same-run, read-only AI Gateway budget
verification before the generated file may contain its temporary attestation.

## `validatePreviewAcceptanceWorkflowInputs`

Maps an exact operator operation and fault choice to one acceptance selector.
Invalid or mixed choices fail before any deployment.

## `preparePreviewAcceptanceDeployConfig`

Returns a new validated candidate with one bounded expiry while leaving the
normal input unchanged.

## `isRunId`

Accepts only a positive workflow-run identifier used by lifecycle operations.

## `readArguments`

Accepts only unique named flag pairs. Aliases, repeats, missing values, and
positional values fail closed.

## `main`

Supports the workflow-input verification mode and the fixed generated-file
build mode. It writes only `dist/vision/wrangler.acceptance.json` and refuses
to overwrite an existing file.
