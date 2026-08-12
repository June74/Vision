# SB-20260812-124605 — Observer received valid maintenance evidence that failed expectation

- **Status:** awaiting diagnosis
- **Detected:** 2026-08-12T12:46:05Z
- **Area:** Phase B permanent maintenance baseline / GitHub observer
- **Evidence:** The observer pinned to `416d0bf` reached the 12:45 UTC tick. Its fixed category was `consumer_evidence_rejected_by_expectation`; no accepted evidence marker was emitted. Workflow setup, exact-tip checks, and the tail producer boundary completed without provider error text.
- **Impact:** No deployment, rollback, database, R2, Queue, backup-key, Worker-configuration, or application-state mutation occurred. The maintenance gate remains pending.
- **Interpretation:** CI received a structurally valid `vision.calendar-maintenance/v2` record, but one semantic acceptance field did not match the requested tick/success contract. The exact field is not exposed yet.
- **Next action:** Add a fixed, value-free mismatch subcategory (schedule, outcome, category, or deadline) and run one bounded observer. Do not print the evidence record.
