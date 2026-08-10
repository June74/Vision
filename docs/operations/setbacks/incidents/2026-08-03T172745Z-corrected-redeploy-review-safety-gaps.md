# SB-20260803-172745-corrected-redeploy-review-safety-gaps: Corrected redeploy review found four safety gaps

- **Status:** closed
- **First observed:** 2026-08-03T17:27:45.529655Z
- **Last observed:** 2026-08-03T17:52:43.9761767Z
- **Phase/task:** Phase B corrected redeploy controller final review
- **Environment:** Local Windows PowerShell 5.1 corrected-controller suite
- **Version/commit:** candidate `c1911f8`; ignored local operational controller

## Symptom

Independent read-only review found unbounded in-memory output capture, unreliable non-Wrangler cmd launch, ambiguous rollback uncertainty, and unclassified adapter-resolution failures.

## Impact

Live read-only validation and candidate deployment remain paused until each finding is verified, corrected, and regression-tested.

## Reproduction conditions

- Run a child that writes beyond the configured combined output cap and then
  remains alive.
- Pass `pnpm.cmd` through `ProcessStartInfo` with shell execution disabled.
- Force rollback deploy, attribution, or live recheck to fail after candidate
  dispatch.
- Resolve a missing Wrangler or pnpm adapter dependency.

## Safe evidence

- The original runner called `ReadToEndAsync` for both streams and checked size
  only after the child exited.
- The original adapter recognized only `wrangler.cmd`; the controller also
  invokes `pnpm.cmd`.
- Rollback exceptions were reduced to `rolled_back: false` while preserving
  only the candidate failure category.
- Node and entrypoint resolution occurred before native start classification.
- Focused red tests reproduced each contract gap without provider access.

## Attempts and outcomes

1. Replaced complete-string reads with concurrent fixed-size reads and an early
   combined cap for both stdout and stderr.
2. Added exact Wrangler and pnpm Node-entrypoint adapters; unknown batch files
   fail with `native_process_adapter_resolution_failed`.
3. The first child-environment approach exposed the inherited `Path`/`PATH`
   collision in .NET Framework. A disposable Node `--require` bootstrap now
   sets only child Wrangler variables without opening that dictionary.
4. The first Wrangler bootstrap imported the package launcher, but that module
   intentionally runs only as `require.main`; the adapter now runs the real
   distribution CLI as main after the bootstrap hook.
5. One direct Wrangler diagnostic omitted the isolated log wrapper and timed
   out after the sandbox rejected its normal user-log location. No provider
   request or persistent file change occurred; all subsequent probes use the
   isolated adapter.
6. Expanded quoting coverage initially exposed an empty-string parameter
   binding rejection; native argument boundaries now allow and roundtrip it.
7. One coverage patch missed its non-ASCII context and changed no file; it was
   reapplied using bounded ASCII anchors.
8. Rollback now throws `rollback_outcome_uncertain` for deploy, attribution, or
   live-recheck uncertainty, while preserving `candidate_failure_category`.

## Cause classification

- **Confirmed cause:** Four independent controller boundaries lacked either a
  resource bound, a direct Windows-safe adapter, or an explicit uncertainty
  category.
- **Hypotheses:** None remaining for the four reviewed findings.
- **Rejected hypotheses:** Existing small-output and PowerShell-only tests were
  sufficient to validate the production Wrangler and pnpm paths.
- **Known exclusions:** No Cloudflare, Google, Neon, calendar, credential, key,
  database, object-storage, or live deployment state changed during repairs.

## Correction and prevention

- **Correction:** Added bounded chunk reads, early output termination, direct
  adapters with classified resolution, explicit rollback uncertainty, and
  adversarial focused tests.
- **Prevention:** Every operational subprocess must have runtime adapter,
  argument, stdin, output, deadline, process-tree, and uncertainty tests before
  it can authorize a live mutation.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Run a fresh read-only rollback validation before
  any candidate deployment.

## Verification and related work

The expanded suite passes twelve checks and ends with
`corrected_redeploy_native_suite_ok`. It covers small capture and exit codes,
stdout/stderr caps, fake and real adapters, closed stdin, difficult arguments,
timeout/tree behavior, bounded Wrangler JSON, recovery attribution, rollback
uncertainty, bounded cleanup, correlation, and source scope. Independent
re-review confirmed all four findings resolved with no new Critical or
Important issue.

## Recurrence history

- 2026-08-03T17:27:45.529655Z: First observed.
- 2026-08-03T17:48:51.9063506Z: All four findings have focused passing tests and
  the expanded full suite is green; incident contained pending re-review.
- 2026-08-03T17:52:43.9761767Z: Independent re-review confirmed the original
  four findings resolved; incident closed.
