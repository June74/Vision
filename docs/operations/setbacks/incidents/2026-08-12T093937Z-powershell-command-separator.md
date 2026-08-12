# SB-20260812-093937 — PowerShell command separator rejected

- **Status:** contained
- **Detected:** 2026-08-12T09:39:37Z
- **Area:** Phase B setback-ledger publication
- **Symptom:** A combined staging-and-commit command used `&&`, which this PowerShell host rejected before either Git operation began.
- **Impact:** No files were staged or committed by the failed command; no provider or application state changed.
- **Correction:** Run staging and commit as separate commands on this host.

