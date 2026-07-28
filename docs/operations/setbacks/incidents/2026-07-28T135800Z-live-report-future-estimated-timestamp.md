# SB-20260728-135800-live-report-future-estimated-timestamp: Live report used a future estimated timestamp

- **Status:** closed
- **First observed:** 2026-07-28T13:58:00Z
- **Last observed:** 2026-07-28T13:58:00Z
- **Phase/task:** Preview database role probe Task 2 reporting
- **Environment:** Ignored safe live report
- **Version/commit:** `d077516`

## Symptom

One safe incident entry initially used an estimated minute later than the
verified local clock.

## Impact

Only ignored-report chronology was temporarily inaccurate. No tracked source,
provider, secret, database, R2, deployment, restore, or key state changed.

## Reproduction conditions and safe evidence

Compare the manually estimated incident time with a fresh local clock read.

## Cause classification

- **Confirmed cause:** The timestamp was estimated instead of read.
- **Hypotheses:** None.
- **Rejected hypotheses:** System clock rollback.
- **Known exclusions:** No private value was involved.

## Attempts and outcomes

1. The future estimate was detected on the next clock read.
2. The report entry was corrected to the verified ordering-compatible minute.

## Correction and prevention

- **Correction:** Replace the estimate with a clock-derived value.
- **Prevention:** Read the clock before every new live incident entry.
- **Owner:** Codex.
- **Next diagnostic step:** None.

## Verification and related work

The ignored live report chronology no longer contains that future estimate.
