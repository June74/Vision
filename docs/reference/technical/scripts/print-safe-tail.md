# `scripts/print-safe-tail.ts`

Streams Wrangler's JSON output through `createSafeTailAccumulator` and exits
after the first allowlisted scheduled-event classification. If the stream ends
without a scheduled event, it emits a fixed closed-vocabulary result. Raw input
is never written to standard output.
