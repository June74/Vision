# print-safe-tail

## `createPreviewTailObserver`

Creates a deadline-bound signal or uniqueness observer for one exact
acceptance expectation. Fast accepting signals may return the allowlisted
evidence; restore and suppression signals remain output-free.

## `result`

Returns its fixed state.

## `push`

Admits one matching terminal before the close instant. A mismatch, late
terminal, or duplicate uniqueness terminal fails closed.

## `finish`

Closes a uniqueness observer only at or after its real deadline and only when
exactly one terminal was admitted.

## `parseObserverConfiguration`

Accepts one fixed observer mode plus unique `--expectation`, `--closes-at`, and
only the mode-specific scenario or maintenance-tick flag. Every timestamp must
be canonical UTC and every mode/outcome pairing must be exact.

## `isCanonicalInstant`

Recognizes one byte-stable millisecond UTC timestamp.

## `isRejectedTerminalEvent`

Detects a target evidence marker that parsed as JSON but failed the safe
classifier, without printing the rejected line.

## `runLegacyTail`

Preserves the no-argument recovery diagnostic: it prints the first allowlisted
result or the fixed no-event result.

## `runObserverTail`

Runs the strict observer, uses the supplied close instant for uniqueness, and
prints only allowlisted accepting-signal or successful uniqueness evidence.
Restore, suppression, and maintenance success remain output-free.

## `complete`

Closes input once, clears the deadline timer, and selects only exit status plus
an optional allowlisted record.

## `main`

Routes no arguments to the legacy diagnostic. Every observer invocation must
use one of the exact restore, suppression, role, maintenance, foundation, AI,
or fault modes with its semantic flags; invalid commands fail nonzero without
output.

The maintenance mode accepts only `vision.calendar-maintenance/v2` evidence
bound to the requested scheduled tick. Raw logs, URLs, object names, provider
identifiers, and provider-controlled error text never cross stdout.
