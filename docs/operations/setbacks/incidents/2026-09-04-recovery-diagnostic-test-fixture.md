# SB-20260904-recovery-diagnostic-test-fixture: Nested Vitest rows were expanded as arguments

- **Status:** closed
- **First observed:** 2026-09-04 local
- **Last observed:** 2026-09-04 local
- **Phase/task:** Phase C recovery predicate diagnostic tests
- **Environment:** Local synthetic Vitest/PGlite; no live services
- **Version/commit:** Working changes after 7503e0c

## Symptom and impact

One new malformed-result regression expected the existing invalid-row error but
received an undefined-row-length error. No application or live data was changed
by the mistake. The test fixture, not the recovery outcome decoder, was incorrect.

## Reproduction conditions and safe evidence

Passing nested row arrays directly to Vitest it.each caused each array to expand
into positional test arguments. The empty row array supplied no first argument.
The combined run reported 111 passed, 1 failed, and 5 externally gated skips.

## Attempts and cause classification

- **Confirmed cause:** Test table argument expansion, including an empty argument list.
- **Hypotheses:** None needed.
- **Rejected hypotheses:** This fixture error is not a live authentication diagnosis.
- **Known exclusions:** No secrets, external requests, migration, or runtime fix.

## Correction and prevention

Wrap each fixture in an object with a rows property, destructure rows explicitly,
and retain the original error assertion. Owner: Codex. Rerun the focused repository,
sync, and OAuth contract suites before closing this incident.

## Verification and related work

The corrected combined repository/synchronization run passed 112 tests with 5
existing externally gated PostgreSQL skips. All 16 focused OAuth contract tests
also passed. The malformed-result cases now exercise the intended decoder and
verify no observer notification. Preserve the separate open live callback incident.
