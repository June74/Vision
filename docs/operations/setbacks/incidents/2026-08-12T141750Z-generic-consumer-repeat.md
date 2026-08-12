# SB-20260812-141750 — GitHub observer still returned generic consumer failure

- **Status:** awaiting diagnosis
- **Detected:** 2026-08-12T14:17:50Z
- **Area:** Phase B permanent maintenance baseline / GitHub observer
- **Evidence:** The fresh observer pinned to `e1a1ea3` completed after the 14:15 UTC tick and still returned `consumer_nonzero`; the classified failed log had no fixed consumer category, evidence marker, authentication marker, command marker, or Node error marker. The local end-to-end CLI harness now preserves fixed categories through immediate nonzero close.
- **Impact:** No deployment, rollback, database, R2, Queue, backup-key, Worker-configuration, or application-state mutation occurred. The maintenance gate remains pending.
- **Interpretation:** The remaining discrepancy is specific to the GitHub runner’s live tail/consumer execution boundary, not the replacement token metadata or the locally verified supervisor transport.
- **Next action:** Stop blind retries. Perform one controlled GitHub-only diagnostic that reports a fixed producer/consumer lifecycle category from the runner, or inspect the runner’s step-level execution boundary with support. Do not rotate credentials or deploy while this gate is unclassified.
