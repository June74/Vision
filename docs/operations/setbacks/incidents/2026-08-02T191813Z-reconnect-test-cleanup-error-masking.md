# SB-20260802-191813-reconnect-test-cleanup-error-masking: Reconnect PostgreSQL harness cleanup could mask the primary failure

- **Status:** closed
- **First observed:** 2026-08-02T19:18:13.754422Z
- **Last observed:** 2026-08-02T19:24:04.9022363Z
- **Phase/task:** Phase B OAuth reconnect recovery final candidate review
- **Environment:** Local opt-in PostgreSQL test harness review and deterministic fakes
- **Version/commit:** `edcbfb8` plus the unstaged final Task 2 cleanup hardening

## Symptom

The final quality review proved that a cleanup exception could replace the original behavior failure and one throwing release could prevent later cleanup attempts.

## Impact

Production recovery is unaffected, but a future PostgreSQL regression could be misdiagnosed and test resources could remain open.

## Reproduction conditions

Make the behavior callback fail, then make rollback, schema deletion, one
client release, and pool shutdown also fail in the deterministic fake harness.

## Safe evidence

The focused RED result was one pass, one failure, and five database skips;
`end failed` replaced the primary error. No database or credential was used.

## Attempts and outcomes

- RED proved the cleanup failure replaced the original behavior failure.
- The lifecycle now captures the primary failure, attempts every rollback,
  schema deletion, client release, and pool shutdown, and aggregates cleanup
  failures without replacing the primary error.
- GREEN passed both deterministic cleanup regressions with all five database
  cases safely skipped; TypeScript and target diff checks passed.

## Cause classification

- **Confirmed cause:** Nested cleanup exceptions propagated from `finally`, and
  the release loop did not isolate per-client failures.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Production recovery SQL and callback behavior were
  not involved; the defect exists only in the opt-in test harness lifecycle.
- **Known exclusions:** No production, migration, provider, database,
  credential, deployment, key, or private-data state changed.

## Correction and prevention

- **Correction:** Preserve the primary error identity, attach aggregated cleanup
  failures, isolate every cleanup attempt, and propagate cleanup-only failures.
- **Prevention:** Every multi-resource acceptance harness must regression-test
  partial acquisition, cleanup failure, error precedence, per-resource release,
  and final pool shutdown before candidate freeze.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed. Commit the exact one-file fix and
  repeat both candidate reviews as the release plan requires.

## Verification and related work

The deterministic RED/GREEN and local type/diff checks passed. The final
approved direct run then passed all seven tests with zero skipped: two cleanup
regressions plus five real PostgreSQL cases, including generated-schema
cleanup. No connection value or private row was recorded.

## Recurrence history

- 2026-08-02T19:18:13.754422Z: First observed.
- 2026-08-02T19:22:25.7604944Z: Contained after the deterministic correction
  passed two cleanup regressions and safely skipped all five database cases.
- 2026-08-02T19:24:04.9022363Z: Closed after the approved direct disposable
  run passed all seven tests with zero skipped and successful schema cleanup.
