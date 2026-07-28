# SB-20260727-194036-tail-correction-missed-routing-test: Tail correction missed an older cross-cutting workflow test

- **Status:** closed
- **First observed:** 2026-07-27T19:40:36Z
- **Last observed:** 2026-07-28T02:18:06.4385089Z
- **Phase/task:** Preview database role probe Task 1 full gate
- **Environment:** Local and GitHub Actions verification
- **Version/commit:** `9bbc4be`

## Symptom

The corrected workflow uses a 16-minute safe-tail window, but an existing
routing/workflow unit test still asserted the former 85-second command. The
exact reviewed candidate therefore failed its pre-deployment quality gate.

## Impact

The deploy job did not run and the 16-minute restore observation never started.
The temporary secrets remain present and the disposable branch remains
retained for a corrected, reviewed retry.

## Cause classification

- **Confirmed cause:** The correction updated focused safe-tail tests but did
  not update this broader workflow contract assertion.
- **Contributing process failure:** Focused verification and independent review
  did not run or inspect the complete unit suite before the candidate was
  approved and pushed.
- **Known exclusions:** This is not a Cloudflare, Neon, credential, or runtime
  restore failure.

## Correction and prevention

- **Correction:** Update the existing assertion to require the 16-minute
  command and restore-only allowlist filter.
- **Prevention:** Every workflow command change must run the full unit project,
  not only focused test files, before review or deployment.
- **Review response:** Reopen the correction review and require a fresh
  independent verdict on the new exact commit range.

## Verification and related work

The corrected focused test passed 2/2, the full unit suite passed 672 tests
with one skip, and all TypeScript, contract, Worker, documentation, build, and
security gates passed. A fresh independent review of `9bbc4be..7ef941b`
returned specification PASS, quality PASS, safe to redeploy, and zero Critical,
Important, or Minor findings. Its privacy scan covered all 997 added lines and
found no value leak.

## Recurrence history

- 2026-07-28T02:18:06.4385089Z: Recurred when the focused workflow test was
  updated for role-probe-only observation but the older cross-cutting routing
  assertion still required restore-only observation. TypeScript and 719 other
  unit tests passed; no provider, browser, network, commit, push, or private
  state was involved. The matching workflow assertion is updated before the
  complete gate is rerun.
