# SB-20260731-184917-task3-fifth-review-blockers: Fifth Task 3 review found four Important blockers

- **Status:** closed
- **First observed:** 2026-07-31T18:49:17.5535045Z
- **Last observed:** 2026-07-31T19:43:05.2194960Z
- **Phase/task:** Phase B Task 3 fifth sanitized package review
- **Environment:** Local read-only independent review
- **Version/commit:** sanitized package from 24e959f5 through 7d78e14

## Symptom

One reviewer returned no blockers, while the other two reported four unique
Important blockers:

1. The real Windows supervisor selects a command-script executable but launches
   it without the trusted Windows command interpreter; injected CLI tests do
   not cover that production branch.
2. Legacy candidate expiry validation checks the timestamp shape without
   proving the date parses and round-trips canonically, so impossible dates can
   be misclassified as exact legacy candidates.
3. Legacy v1 runs cannot contain the newer mutation-boundary artifact, yet zero
   artifacts currently classify as `not_started`; an actually deployed v1
   candidate can therefore be rejected instead of conservatively recovered.
4. The Task 3 report still contains an earlier timeout statement and stale
   commit/verification wording that conflicts with the current package.

## Impact

Task 3 remains unaccepted and Task 4 source work cannot start. No provider,
network, environment, secret, staging, or external mutation occurred during
review.

## Cause classification

- **Confirmed cause:** Windows default-launch behavior, legacy timestamp
  semantics, legacy mutation-state classification, and report consolidation
  each retained one untested or stale branch after the fourth repair.
- **Hypotheses:** None remaining; each finding has a concrete target and
  regression-test requirement.
- **Known exclusions:** The timing/workflow reviewer returned `NO_BLOCKERS` for
  the 2,710-second envelope and seven 48/46-minute job/listener pairs.

## Correction and prevention

- **Correction:** Add RED coverage for the real Windows launch shape, canonical
  legacy expiry round-trip, and v1 zero-artifact conservative recovery; apply
  minimal fixes; consolidate the report; rerun focused and complete gates; then
  conduct another three-reviewer sanitized-package wave.
- **Prevention:** Test platform-default command resolution separately from
  injected executables, require semantic timestamp canonicalization wherever
  legacy provider state is admitted, derive legacy mutation state from the
  schema version, and keep one current report summary.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Trace the real Windows supervisor launch and the
  v1 zero-artifact classifier before writing RED tests.

## Recurrence history

- 2026-07-31T18:49:17.5535045Z: Fifth review completed with four unique
  Important blockers; Task 3 remained contained.
- 2026-07-31T19:43:05.2194960Z: Closed after the shell-free real-entrypoint
  supervisor, canonical legacy expiry, conservative v1 classification, and
  consolidated report passed focused and complete gates and were validated by
  the sixth review. Later sixth-review findings are tracked separately.
