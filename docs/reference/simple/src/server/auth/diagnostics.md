# Authentication diagnostics

Names which step of Google sign-in failed, using a fixed list of category codes. Preview deployments
show the category so a live failure can be located; local and production responses stay unchanged.
Safe logs can include a fixed category in any environment.

## `runAuthStage`

Runs one sign-in step and labels any failure with that step's category code.

## `readAuthDiagnosticStage`

Reads the category recorded on a failure, or `unclassified` when none was recorded.

## `readAuthFailureCause`

Returns the original failure behind a category label so callers can still recognize a denied account.

## `readPreviewDiagnosticStage`

Releases the category only on preview, keeping local and production responses unchanged.
