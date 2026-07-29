# validate-preview-acceptance-window

Stops a temporary preview candidate from being prepared or deployed during
the protected period around normal daily recovery work.

## `assertPreviewAcceptanceWindow`

Accepts a valid clock instant only when it is outside the protected UTC
window. Invalid clocks fail closed.

## `main`

Checks the current clock, accepts no command arguments, and prints only a
fixed safe result.
