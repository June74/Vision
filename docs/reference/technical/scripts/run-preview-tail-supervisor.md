# `scripts/run-preview-tail-supervisor.ts`

Supervises the long-running Wrangler producer and the bounded evidence
consumer as separate captured child processes. Raw producer stdout is routed
only to the consumer; provider and producer stderr remain discarded. The
consumer may emit one fixed diagnostic category when explicitly enabled by the
supervisor.

## `createDefaultPreviewTailCommandPlan`

Resolves `wrangler/package.json`, derives its absolute `bin/wrangler.js`, and
resolves the installed `tsx/cli` entrypoint. Both commands use
`process.execPath`; the producer receives the fixed Wrangler tail arguments
and the consumer receives the absolute safe-tail script followed by exact
forwarded array elements. No `pnpm.cmd`, `cmd.exe`, shell string, or shell
interpolation is involved.

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

## `detail`

Builds the bounded `PreviewTailFailureDetail` snapshot used when a failure is
settled. `consumerExitCode` is present only for a consumer that closed on its
own, while `producerClosedFirst` records only a producer close that preceded
that consumer boundary.

## `validateCommand`

Validates and defensively copies the executable and at most 32 bounded,
newline-free arguments before either spawn.

## `spawnCommand`

Starts one validated hidden, fully captured child with no shell parsing.

## `classifyConsumerFailureCategory`

Parses only the consumer's fixed `Preview tail observer failed closed` category
line and maps the allowlisted words to supervisor categories. Arbitrary child
stderr is never forwarded or retained.

## `waitForChildClose`

Handles the close/error race and resolves only after a child is closed or
proved unspawnable.

## `stopChild`

Sends `SIGTERM` to one live child and awaits the close boundary used by both
failure cleanup and early-consumer handling.

## `main`

Uses the shell-free default command plan and forwards only the observer's
already-validated stdout. The spawned CLI acceptance harness can substitute
one absolute test executable/script pair only under `NODE_ENV=test`; partial
or production overrides fail closed.
