# validate-preview-ai-browser-request

Runs the one approved AI acceptance request inside the authenticated browser
page while keeping all private request details inside that page.

## `PreviewAiBrowserStatusClass`

Limits the outcome to success, an HTTP failure, an abort, a network failure, or
a disconnected page.

## `PreviewAiBrowserSafeResult`

Contains only canonical request start and completion times, a success Boolean,
and the limited status class.

## `PreviewAiBrowserRequestDependencies`

Provides the page check, UTC and monotonic clocks, one fetch function, one abort
controller, and timer functions needed for deterministic testing.

## `executeOneBrowserScopedAiRequest`

Requires the request to start after approval and within its 60-second lifetime.
It calls the private factory and fetch once, aborts after 35 seconds, drains and
discards response bytes, clears its timer, and never retries. It returns only
the safe result and rejects an invalid timeline with one fixed error. Once the
deadline aborts, the result remains aborted even if fetch later fulfills.

## `abortAtDeadline`

Aborts the request at the fixed monotonic deadline and rearms a timer that fires
early.

## `instant`

Reads a valid timestamp from a `Date` without trusting overridden methods.

## `dependencyInstant`

Reads the injected UTC clock and converts any clock problem to the fixed safe
error.

## `finiteMonotonic`

Accepts only a finite, nonnegative monotonic clock value.

## `pageContextAvailable`

Checks page liveness without allowing browser adapter errors to escape.

## `canonicalInstant`

Formats a validated timestamp as canonical millisecond UTC text.

## `fail`

Throws the helper's single privacy-safe validation error.
