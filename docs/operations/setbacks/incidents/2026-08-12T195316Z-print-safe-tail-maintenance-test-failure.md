# SB-20260812-195316 - Full unit run failed in local maintenance-only tail test

- **Status:** contained
- **Detected:** 2026-08-12T19:50:26Z
- **Last observed:** 2026-08-12T19:58:18.706Z
- **Area:** Phase B local verification / bounded tail observer
- **Evidence:** The full unit suite completed with 1 failure, 1,794 passed,
  and 6 skipped. The failing test was the local
  `print-safe-tail` maintenance-only case; its child returned exit code `1`
  where the test expected `0`. No raw child output was retained.
- **Impact:** No deployment, rollback, provider, database, R2, Queue,
  credential, or Worker configuration state changed. The Phase B code change
  remained local while the verification failure was classified.
- **Interpretation:** This is a local verification failure, not evidence of a
  new provider-side behavior. The failure must be reproduced in isolation and
  classified before changing the observer or acceptance contract.
- **Resolution:** The named test passed in isolation. Its synthetic child had
  only a 3.4-second startup/close margin, which was insufficient under the
  four-worker full unit suite. The test now uses an 8.4-second margin without
  changing the observer contract or production behavior. The full unit suite
  then passed with 1,795 tests passed and 6 skipped.
- **Prevention:** Keep process-spawn tests' close margin comfortably above the
  repository's bounded Windows worker-startup variance; do not alter acceptance
  semantics to accommodate a local test harness timeout.
