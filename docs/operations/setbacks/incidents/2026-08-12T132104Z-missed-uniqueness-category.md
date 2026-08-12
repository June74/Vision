# SB-20260812-132104 — Uniqueness timer missed the diagnostic category

- **Status:** contained
- **Detected:** 2026-08-12T13:21:04Z
- **Area:** Phase B CI tail-supervisor diagnosis
- **Evidence:** The observer’s uniqueness timer called `complete` without a failure category after an observer state had failed, collapsing the result to generic `consumer_nonzero`.
- **Impact:** No provider, deployment, credential, database, or key state changed; only the safe diagnostic category was incomplete.
- **Resolution:** The timer now emits the fixed `observer_uniqueness_failed` category while preserving the existing fail-closed behavior.
- **Prevention:** Audit every failure exit from a privacy-safe observer, including timer and stream-close branches.
