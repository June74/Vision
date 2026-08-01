# Setback SB-20260801-004315-ledger-apply-patch-hang

- **Status:** closed
- **Detected:** 2026-08-01T00:43:15.6288058Z
- **Scope:** Phase B Gate 0 setback-ledger maintenance

## What happened

A three-file `apply_patch` call using absolute Windows paths produced no result
for roughly 50 seconds and was terminated. A subsequent exact read confirmed
that none of the intended edits had been applied. The first relative-path
retry then resolved from the parent workspace rather than the Phase B
worktree, creating one incident file in the wrong checkout.

## Impact

The setback ledger update was delayed. One new, controller-owned documentation
file was briefly created in the parent checkout. No implementation, Git,
database, Cloudflare, Google, or R2 state changed, and the separate
verification process cell remained available.

## Cause classification

- **Confirmed cause:** Absolute paths stalled, while relative paths were
  resolved from the tool's workspace root rather than the shell workdir.
- **Rejected hypothesis:** A partial write in the Phase B worktree; exact reads
  found none before the qualified retry.

## Correction and prevention

- **Correction:** Use `.worktrees/phase-b-foundation/`-qualified patch paths
  and delete only the newly created stray file from the parent checkout.
- **Prevention:** Do not assume shell `workdir` affects `apply_patch` path
  resolution.
- **Owner:** Codex.
- **Verification:** Every intended worktree ledger line was found, and the
  parent-checkout stray path was absent after the qualified patches.
