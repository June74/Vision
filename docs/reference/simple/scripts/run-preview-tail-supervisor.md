# run-preview-tail-supervisor

Runs the raw preview tail behind the privacy-safe observer. It captures both
children, never prints raw producer output, and owns the producer shutdown
after the observer has proved success.

## `supervisePreviewTail`

Starts the producer and observer with argument arrays. Observer success causes
a deliberate producer termination and is successful; early producer exit,
observer failure, or oversized output fails closed.

## `rejectClosed`

Stops both children and returns only the fixed safe error.

## `spawnCommand`

Checks bounded executable and argument values, then starts a captured child
without a shell.

## `main`

Uses the fixed Wrangler tail producer and the allowlisting
`print-safe-tail.ts` observer used by the preview workflow.
