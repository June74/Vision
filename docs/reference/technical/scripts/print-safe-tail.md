# `scripts/print-safe-tail.ts`

## `createPreviewTailObserver`

Creates one clocked observer in `accepting_signal`, restore/suppression signal,
restore/suppression uniqueness, or maintenance uniqueness mode. It evaluates
the complete semantic expectation rather than only the evidence marker.

## `result`

Builds the frozen `{ done, succeeded, output }` state.

## `push`

Rejects expectation mismatches, late terminals, and duplicate uniqueness
terminals. Generic accepting signals return the reconstructed safe evidence;
restore and suppression signals return no evidence.

## `finish`

Succeeds only at or after `closesAt` with exactly one previously admitted
terminal.

## `parseObserverConfiguration`

Parses one closed mode plus unique flag/value pairs. It requires canonical
mode/expectation agreement, a fault scenario only for `fault_expected`, and
`--maintenance-scheduled-at` only for the two maintenance outcomes. It rejects
the removed `--closes-at` flag and derives maintenance close internally.

## `isCanonicalInstant`

Requires the millisecond UTC grammar and round-trip byte identity.

## `isRejectedTerminalEvent`

Recognizes a parsed target-marker line rejected by `createSafeTailAccumulator`
so a malformed terminal fails immediately without being rendered.

## `runLegacyTail`

Runs only when the executable receives no arguments. It retains the bounded
recovery diagnostic and its fixed no-event fallback.

## `runObserverTail`

Feeds reconstructed safe records into the configured observer, installs the
true uniqueness deadline, and never echoes raw input. A closed stdin before a
valid signal or before successful uniqueness is a failure.

## `complete`

Makes completion idempotent, clears the timer, optionally serializes one
allowlisted record, destroys stdin, and sets only the success/failure exit
status.

## `main`

Separates the legacy no-argument path from strict observer commands. Invalid
argument vectors exit nonzero with empty stdout and stderr.

Observer modes cover the exact safe-tail evidence families. Maintenance is
bound to `vision.calendar-maintenance/v2` and its requested scheduled tick;
fault evidence is bound to the requested scenario. Signal jobs return
immediately, while uniqueness jobs remain open through the internally derived
close instant.
