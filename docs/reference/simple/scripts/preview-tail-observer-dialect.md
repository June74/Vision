# preview-tail-observer-dialect

Defines the small, privacy-safe stderr protocol shared by the preview tail
observer and its supervisor. It admits fixed categories only and never returns
provider-controlled text.

## `PREVIEW_TAIL_OBSERVER_FAILURE_CATEGORIES`

An immutable tuple of the fourteen reviewed observer failure categories. The
emitter and supervisor use this same vocabulary, including maintenance
schedule, outcome, category, repair, renewal, and reservation failures.

## `PREVIEW_TAIL_OBSERVER_FAILURE_MAX_BYTES`

Sets the parser's input limit to 128 UTF-8 bytes. The supervisor retains only a
bounded suffix while joining stderr chunks.

## `parsePreviewTailObserverFailureMarker`

Accepts only a complete line with the exact fixed prefix, one category from the
shared tuple, a period, and an LF or CRLF line boundary. Unknown categories,
extra fields, oversized input, and malformed text return `null`.
