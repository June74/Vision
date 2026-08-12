# SB-20260812-120802 — Ledger patch expected a missing context row

- **Status:** contained
- **Detected:** 2026-08-12T12:08:02Z
- **Area:** Phase B maintenance observer diagnosis
- **Evidence:** An index-only patch expected a test-inspection row that had not yet been appended to the current index tail, so apply_patch rejected it.
- **Impact:** No repository, provider, deployment, secret, database, or application state changed.
- **Resolution:** Append all currently unindexed incident rows together using the actual index tail.
- **Prevention:** Re-read the index after every incident-file creation batch before patching its rows.
