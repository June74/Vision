# `scripts/safe-tail-classifier.ts`

Provides the closed, privacy-safe projection used for live scheduled-backup
acceptance. It incrementally parses Wrangler's pretty JSON, caps buffered input
at one MiB, recognizes only the approved recovery crons, and emits no
provider-controlled fields.

## `createSafeTailAccumulator`

Creates a stateful line accumulator that resets after one complete JSON value
or after the one-MiB safety cap.

## `push`

Adds one raw line, returns `null` for incomplete or irrelevant input, and
returns `SafeTailEvidence` only for a complete recognized event.

## `classifySafeTailLine`

Parses one JSON value, requires a recognized scheduled cron, maps known fixed
backup messages to allowlisted categories, and otherwise uses
`unknown_failure`.

## `normalizeOutcome`

Maps `ok`, `exception`, `canceled`, and `exceededCpu` to the public evidence
vocabulary; every other value becomes `unknown`.

## `isRecord`

Narrows parsed input to a non-null, non-array object before field access.
