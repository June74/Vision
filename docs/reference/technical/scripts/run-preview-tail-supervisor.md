# `scripts/run-preview-tail-supervisor.ts`

Supervises the long-running Wrangler producer and the bounded evidence
consumer as separate captured child processes. Raw producer stdout is routed
only to the consumer; producer and consumer stderr are discarded.

## `supervisePreviewTail`

Snapshots both commands before any process starts, spawns and confirms the
consumer first, then spawns the producer with `shell: false`. It pipes producer
stdout to consumer stdin and bounds captured consumer stdout. A zero-exit
consumer becomes success only after the supervisor deliberately terminates
and reaps the still-running producer. Any producer close before consumer
completion, nonzero consumer, spawn error, or oversized capture terminates and
reaps every started side before rejecting with the constant failure.

## `rejectClosed`

Unpipes the children, sends termination to each live child, awaits their
closure, and rejects once without forwarding child data.

## `validateCommand`

Validates and defensively copies the executable and at most 32 bounded,
newline-free arguments before either spawn.

## `spawnCommand`

Starts one validated hidden, fully captured child with no shell parsing.

## `waitForChildClose`

Handles the close/error race and resolves only after a child is closed or
proved unspawnable.

## `stopChild`

Sends `SIGTERM` to one live child and awaits the close boundary used by both
failure cleanup and early-consumer handling.

## `main`

Builds the fixed `pnpm exec wrangler tail vision-preview --format json`
producer and fixed `pnpm exec tsx scripts/print-safe-tail.ts` consumer,
forwarding only the observer's already-validated stdout. The spawned CLI
acceptance harness can substitute one absolute test executable/script pair
only under `NODE_ENV=test`; partial or production overrides fail closed.
