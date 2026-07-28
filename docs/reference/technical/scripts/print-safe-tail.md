# `scripts/print-safe-tail.ts`

Streams Wrangler's JSON output through `createSafeTailAccumulator` and exits
after the first allowlisted scheduled-event classification. The fixed
`--restore-only` option accepts only reconstructed
`vision.preview-restore/v1` evidence, ignoring recovery classifications while
the stream remains open. The fixed `--role-probe-only` option accepts only
reconstructed `vision.preview-role-probe/v1` evidence and ignores both recovery
and restore results. The fixed `--calendar-maintenance-only` option accepts
only reconstructed `vision.calendar-maintenance/v1` evidence from the normal
15-minute cron. The fixed `--foundation-probe-only` option accepts only
reconstructed `vision.phase-b-foundation-probe/v1` evidence from a one-minute
observation. If no accepted result arrives before input closes, it emits a
fixed closed-vocabulary result. Raw input is never written to standard output.
Every argument vector other than no option or one exact fixed option exits
nonzero without output.
