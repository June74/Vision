# Authentication diagnostics

Names which step of Google sign-in failed, using a fixed list of category codes. Preview deployments
show the category so a live failure can be located; local and production responses stay unchanged.
Safe logs can include a fixed category in any environment.

`callback_authorization_recovery_conflict` means the recovery check explicitly
refused sign-in. `callback_authorization_recovery_failed` means the recovery call
threw an error or returned an invalid result. Neither category reveals private
data, changes the login rules, or identifies the exact database problem.
Preview can also name one specific failed recovery check using a fixed `callback_recovery_` category.
Only the first mismatch is shown: token checks come before calendar-link checks, which come before
disconnect-marker checks. This names a failed check, not its root cause or the private values involved.
Local and production keep generic conflict logs as well as unchanged responses.

## `runAuthStage`

Runs one sign-in step and labels any failure with that step's category code.

## `readAuthDiagnosticStage`

Reads the category recorded on a failure, or `unclassified` when none was recorded.

## `readAuthFailureCause`

Returns the original failure behind a category label so callers can still recognize a denied account.

## `readAuthorizationRecoveryDiagnosticStage`

Translates a recognized recovery reason into a fixed category without reading object properties or
copying arbitrary text. An unknown reason, malformed value, or `unclassified` becomes the generic
recovery-conflict category. The callback uses the result only on preview and only when recovery's
final answer is `conflict`; a notification cannot approve or refuse a session by itself.

## `readPreviewDiagnosticStage`

Releases the category only on preview, keeping local and production responses unchanged.
