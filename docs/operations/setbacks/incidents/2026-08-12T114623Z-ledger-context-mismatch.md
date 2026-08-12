# SB-20260812-114623 — Ledger patch used a not-yet-indexed context row

- **Status:** contained
- **Detected:** 2026-08-12T11:46:23Z
- **Area:** Phase B maintenance observer diagnosis
- **Evidence:** A combined incident patch expected a stale-input incident row that had not yet been inserted into the setback index, so apply_patch rejected the patch.
- **Impact:** No repository or provider state changed.
- **Resolution:** Add incident files first, then append all missing index rows using the actual current tail.
- **Prevention:** Read the index immediately before every generated insertion patch.
