# `scripts/print-safe-tail.ts`

Streams Wrangler's JSON output through `createSafeTailAccumulator` and exits
after the first allowlisted scheduled-event classification. The fixed
`--restore-only` option accepts only reconstructed
`vision.preview-restore/v1` evidence, ignoring recovery classifications while
the stream remains open. If no accepted result arrives before input closes, it
emits a fixed closed-vocabulary result. Raw input is never written to standard
output.
