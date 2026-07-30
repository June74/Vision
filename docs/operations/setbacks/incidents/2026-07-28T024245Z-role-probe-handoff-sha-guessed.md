# SB-20260728-024245-role-probe-handoff-sha-guessed: Role-probe handoff SHA was guessed

- **Status:** closed
- **First observed:** 2026-07-28T02:42:45Z
- **Last observed:** 2026-07-30T00:05:36.3524779Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final re-review
- **Environment:** Local worktree
- **Version/commit:** `e2d85ce0f63de1f29fffe0368fcf5d4e06cdf121`

## Symptom

The immutable Task 2 brief named a full commit SHA that did not resolve even
though its seven-character prefix matched the reviewed role-probe commit. The
live subagent stopped before accessing any provider.

## Impact

The already-approved live probe was delayed at its first preflight check. No
Cloudflare or Neon state changed, no deployment or database mutation occurred,
and no private value was exposed.

## Reproduction conditions and safe evidence

- The handoff brief expanded `e2d85ce` to an unverified full value.
- `git rev-parse e2d85ce`, local `HEAD`, and
  `origin/codex/phase-b-foundation` all resolve to
  `e2d85ce0f63de1f29fffe0368fcf5d4e06cdf121`.
- The live subagent rejected the non-resolving immutable value before provider
  access.

## Cause classification

- **Confirmed cause:** The controller manually completed a short commit SHA
  instead of reading the exact object ID from Git before writing the handoff.
- **Hypotheses:** None.
- **Rejected hypotheses:** The reviewed implementation was not missing or
  unpushed; local and remote branch tips resolve to the same exact commit.
- **Known exclusions:** No provider access, secret change, deployment, database
  operation, R2 operation, or encryption-key change occurred.

## Attempts and outcomes

1. The live subagent performed a clean immutable-ref preflight and stopped when
   the supplied SHA did not resolve.
2. A quiet remote refresh confirmed the same branch tip.
3. The controller resolved the short SHA directly with Git and obtained the
   exact reviewed commit ID.
4. The first correction patch expected the SHA without its Markdown backticks
   and applied nothing; reading the exact line supplied the correct patch
   context.

## Correction and prevention

- **Correction:** Replace the bad value in the ignored live brief with the
  exact Git-resolved SHA, then resume the same subagent from Step 1.
- **Prevention:** Never manually expand a short SHA. Resolve every immutable
  handoff reference with `git rev-parse`, inspect the exact target line, and
  compare local and remote tips before dispatch.
- **Owner:** Codex.
- **Next diagnostic step:** Resume the live probe and verify its immutable-ref
  preflight passes before any provider action.

## Verification and related work

At 2026-07-28T02:42:45Z, the exact reviewed commit resolved locally and both
local `HEAD` and `origin/codex/phase-b-foundation` matched it.

## Recurrence history

- 2026-07-30T00:05:36.3524779Z: The controller again manually expanded a
  seven-character commit prefix when dispatching both final reviewers. The
  reviewers independently resolved the real object ID while still at the
  package header and stopped before reading the diff. Both reviews paused, no
  provider or repository state changed, and future reviewer prompts use only a
  Git-resolved full object ID.
