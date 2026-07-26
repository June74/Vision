# safe-tail-classifier

Turns a Cloudflare scheduled-event log into a tiny safe result containing only
the known backup schedule, outcome, and an allowlisted failure category.

## `createSafeTailAccumulator`

Collects pretty-printed JSON one line at a time without showing it.

## `push`

Accepts one line and returns a safe result only after one complete event exists.

## `classifySafeTailLine`

Recognizes only the temporary or normal backup schedules and maps known backup
failures to fixed names.

## `normalizeOutcome`

Converts Cloudflare's outcome into Vision's small approved outcome list.

## `isRecord`

Checks that parsed JSON is an object before its fields are read.
