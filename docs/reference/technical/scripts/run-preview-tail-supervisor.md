# `scripts/run-preview-tail-supervisor.ts`

Supervises the long-running Wrangler producer and the bounded evidence
consumer as separate captured child processes. Raw producer stdout is routed
only to the consumer; producer and consumer stderr are discarded.

## `supervisePreviewTail`

Spawns both commands with `shell: false`, pipes producer stdout to consumer
stdin, and bounds captured consumer stdout. A zero-exit consumer becomes
success only after the supervisor deliberately terminates the still-running
producer. Any producer close before consumer completion, nonzero consumer,
spawn error, or oversized capture terminates both sides and rejects with the
constant failure.

## `rejectClosed`

Unpipes the children, sends termination to each live child, and rejects once
without forwarding child data.

## `spawnCommand`

Validates the executable and at most 32 bounded newline-free arguments before
starting a hidden, fully captured child with no shell parsing.

## `main`

Builds the fixed `pnpm exec wrangler tail vision-preview --format json`
producer and fixed `pnpm exec tsx scripts/print-safe-tail.ts` consumer,
forwarding only the observer's already-validated stdout.
