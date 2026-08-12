# run-preview-tail-supervisor

Runs the raw preview tail behind the privacy-safe observer. It captures both
children, never prints raw producer output, and owns the producer shutdown
after the observer has proved success.

## `createDefaultPreviewTailCommandPlan`

Resolves the installed Wrangler and TSX program files and builds two fixed
Node argument arrays. Forwarded observer arguments stay separate array
elements; no command shell or platform-specific command script is used.

## `supervisePreviewTail`

Validates both argument arrays before starting anything, starts and confirms
the observer first, and only then starts the producer. Observer success causes
a deliberate producer termination and is successful; early producer exit,
observer failure, or oversized output fails closed.

## `rejectClosed`

Stops every started child, waits for process closure, and returns only the
fixed safe error.

## `validateCommand`

Snapshots one bounded executable and argument array before either child starts.

## `spawnCommand`

Starts an already validated captured child without a shell.

## `classifyConsumerFailureCategory`

Recognizes only the safe-tail consumer's fixed diagnostic words and maps them
to a supervisor category; all other child text is ignored.

## `waitForChildClose`

Waits until a started child is reaped or an unspawnable child reports its
error.

## `stopChild`

Terminates one live child and waits for closure before supervision settles.

## `main`

Uses the fixed Wrangler tail producer and the allowlisting
`print-safe-tail.ts` observer used by the preview workflow. Production launches
both installed program files through the current Node executable with no shell.
Spawned CLI tests may supply an absolute executable/script pair only while
`NODE_ENV=test`.
