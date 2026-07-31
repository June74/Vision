# `scripts/validate-preview-ai-browser-request.ts`

Defines the page-context request boundary used by the temporary preview AI
acceptance flow. The module has no command-line entry point, logging path, or
request serialization path.

## `PreviewAiBrowserStatusClass`

A closed union of `success`, `http_failure`, `aborted`, `network_failure`, and
`page_disconnected`. Provider error text and HTTP status values are not part of
the contract.

## `PreviewAiBrowserSafeResult`

Returns exactly canonical millisecond UTC `startedAt` and `completedAt` strings,
the derived `succeeded` Boolean, and `statusClass`. The result is frozen and
`succeeded` is true exactly when `statusClass` is `success`.

## `PreviewAiBrowserRequestDependencies`

Injects page-liveness detection, UTC and monotonic clocks, fetch, abort-controller
construction, and timer operations. This keeps timing and failure behavior
deterministic without adding a non-page execution path.

## `executeOneBrowserScopedAiRequest`

Validates that request start is strictly after approval, no more than 60 seconds
later, and before the evidence instant. It arms a 35,000-millisecond monotonic
abort deadline, calls the private request factory and fetch at most once, forces
the generated abort signal onto the private request, drains the response through
`arrayBuffer()`, discards the bytes, and clears the timer in every armed path.

After transport completion it requires `startedAt <= completedAt <
evidenceScheduledAt`. Abort state takes precedence over a later fulfilled fetch.
Page loss, abort, HTTP failure, and transport uncertainty map to the closed
status union without retrying or propagating private error details. Invalid
context, clocks, or timing throw only the fixed privacy-safe validation error.

## `abortAtDeadline`

Compares the injected monotonic clock with the fixed deadline, rearms for the
exact remaining duration after an early firing, and otherwise aborts once. A
clock or abort-adapter failure is contained without exporting its error detail.

## `instant`

Calls `Date.prototype.getTime` directly and accepts only a finite epoch value.

## `dependencyInstant`

Normalizes injected UTC-clock failures through `instant` and the module's sole
safe error.

## `finiteMonotonic`

Rejects non-finite and negative elapsed-clock values.

## `pageContextAvailable`

Returns true only for an exact true result and maps a thrown page probe to
disconnected state.

## `canonicalInstant`

Formats an already validated epoch value with `Date.prototype.toISOString`.

## `fail`

Throws only `Preview AI browser request is invalid.`.
