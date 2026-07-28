# `scripts/print-safe-tail.ts`

Streams Wrangler's JSON output through `createSafeTailAccumulator` and exits
after the first allowlisted scheduled-event classification. The fixed
`--restore-only` option accepts only reconstructed
`vision.preview-restore/v1` evidence, ignoring recovery classifications while
the stream remains open. The fixed `--role-probe-only` option accepts only
reconstructed `vision.preview-role-probe/v1` evidence and ignores both recovery
and restore results. If no accepted result arrives before input closes, it
emits a fixed closed-vocabulary result. Raw input is never written to standard
output. Every argument vector other than no option or one exact fixed option
exits nonzero without output.
