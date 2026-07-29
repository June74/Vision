# `scripts/prepare-preview-acceptance-deploy-config.ts`

Creates the isolated, generated preview acceptance candidate from the exact
normal artifact. The source must satisfy `validatePreviewDeployConfig`; the
returned clone must satisfy `validatePreviewAcceptanceDeployConfig`.

The frozen selector vocabulary is `foundation_probe`, `ai_usage`, and the six
temporary fault scenarios. Every candidate has the two normal crons plus
`* * * * *` and the exact `PREVIEW_ACCEPTANCE_SCENARIO` binding. Only
`ai_usage` may carry
`PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED=true`, and that value is admitted
only from the workflow's same-run read-only gateway verifier.

## `validatePreviewAcceptanceWorkflowInputs`

Requires the exact operation/fault matrix and returns one selector. It rejects
extra, missing, or cross-operation fault choices with a generic safe error.

## `preparePreviewAcceptanceDeployConfig`

Validates the normal artifact, performs a structured clone, adds only the
temporary cron and admitted bindings, then validates the complete candidate.

## `readArguments`

Parses unique `--name value` pairs without aliases or coercion. The dedicated
workflow-verification flag is handled before this parser.

## `main`

`--verify-workflow-inputs` validates dispatch selection without reading or
writing artifacts. Candidate generation accepts only the fixed normal input
and acceptance output paths, requires an admitted selector combination, and
uses exclusive creation so an existing candidate cannot be overwritten.
