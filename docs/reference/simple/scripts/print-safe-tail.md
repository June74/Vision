# print-safe-tail

## `createPreviewTailObserver`

Creates a deadline-bound signal or uniqueness observer for one exact
acceptance expectation. Fast accepting signals may return the allowlisted
evidence; restore, suppression, and AI signals remain output-free. AI
uniqueness closes only at the admitted expiry plus three minutes.

## `result`

Returns its fixed state.

## `push`

Admits one matching terminal before the close instant. A mismatch, late
terminal, or duplicate uniqueness terminal fails closed.

## `finish`

Closes a uniqueness observer only at or after its real deadline and only when
exactly one terminal was admitted.

## `parseObserverConfiguration`

Accepts one fixed observer mode plus unique `--expectation` and only the
mode-specific scenario or maintenance-tick flag. Maintenance derives its
close as the scheduled tick plus 120 seconds; the removed `--closes-at` flag
fails closed. AI uniqueness alone requires canonical `--expires-at`.

## `isCanonicalInstant`

Recognizes one byte-stable millisecond UTC timestamp.

## `isRejectedTerminalEvent`

Detects a target evidence marker that parsed as JSON but failed the safe
classifier, without printing the rejected line.

## `expectedEvidenceType`

Maps each expectation to its one admitted terminal evidence family.

## `isExpectedEvidence`

Ignores a valid terminal from another scheduled family while retaining only
the evidence family the observer is waiting for.

## `runLegacyTail`

Preserves the no-argument recovery diagnostic: it prints the first allowlisted
result or the fixed no-event result.

## `runObserverTail`

Runs the strict observer, derives maintenance close from its tick and other
uniqueness close from the admitted terminal, and prints only allowlisted
accepting-signal or successful uniqueness evidence. Restore, suppression, and
maintenance success remain output-free.

## `copyValidDate`

Copies one finite `Date` for the AI expiry boundary without retaining mutable
caller state.

## `complete`

Closes input once, clears the deadline timer, and selects only exit status plus
an optional allowlisted record.

## `emitObserverFailure`

When the supervisor asks for diagnosis, emits only a fixed failure category to
stderr; it never prints the rejected tail record.

## `classifyExpectationFailure`

Names the kind of maintenance expectation mismatch using fixed words only;
scheduled values and event contents stay private.

## `classifyExpectationFailure`

Names a maintenance expectation mismatch using fixed words only; scheduled
values and event contents stay private.

## `main`

Routes no arguments to the legacy diagnostic. Every observer invocation must
use one of the exact restore, suppression, role, maintenance, foundation, AI,
or fault modes with its semantic flags; invalid commands fail nonzero without
output.

The maintenance mode accepts only `vision.calendar-maintenance/v2` evidence
bound to the requested scheduled tick. Raw logs, URLs, object names, provider
identifiers, and provider-controlled error text never cross stdout. A failed
uniqueness close uses only the fixed `observer_uniqueness_failed` word.
