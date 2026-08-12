# `scripts/preview-tail-observer-dialect.ts`

This module is the single source of truth for the observer-to-supervisor
failure dialect. It is deliberately separate from the Wrangler producer and
contains no provider response or process state.

## `PREVIEW_TAIL_OBSERVER_FAILURE_CATEGORIES`

Exports an immutable fourteen-token tuple shared by `print-safe-tail.ts` and
`run-preview-tail-supervisor.ts`. The tuple includes the six maintenance
categories that previously drifted out of the supervisor's local allowlist.

## `PREVIEW_TAIL_OBSERVER_FAILURE_MAX_BYTES`

Exports the 128-byte UTF-8 bound used by the parser and the supervisor's
rolling diagnostic suffix. The bound limits retained inspection data without
altering the existing full stderr byte counter.

## `parsePreviewTailObserverFailureMarker`

Matches only the fixed marker grammar
`Preview tail observer failed closed: <category>.` with line boundaries. The
category must be present in the shared immutable tuple. The parser accepts LF
and CRLF, rejects unknown or value-bearing text, and returns only the raw
allowlisted category or `null`.
