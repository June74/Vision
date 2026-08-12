# SB-20260812-123105 — Categorized observer run failed in consumer

- **Status:** awaiting diagnosis
- **Detected:** 2026-08-12T12:31:05Z
- **Area:** Phase B permanent maintenance baseline / GitHub observer
- **Evidence:** The fresh observer pinned to the verified `af9663f` tip reached the 12:30 UTC tick, then the CI tail step returned the new fixed category `consumer_nonzero`; no accepted maintenance evidence marker was present. The workflow setup and exact-tip checks passed.
- **Impact:** No deployment, rollback, database, R2, Queue, backup-key, Worker-configuration, or application-state mutation occurred. The maintenance gate remains pending.
- **Interpretation:** The GitHub tail producer stayed alive long enough to reach the tick, but the privacy-safe consumer rejected or otherwise failed on its input. The exact consumer subcategory is not yet exposed.
- **Next action:** Add an opt-in, fixed-category diagnostic channel from the safe-tail consumer through the supervisor, then run one bounded observer. Do not expose provider stderr or raw tail records.
