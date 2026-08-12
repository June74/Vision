# SB-20260812-111750 — Diagnostic command referenced an absent script

- **Status:** contained
- **Detected:** 2026-08-12T11:17:50Z
- **Area:** Phase B maintenance observer diagnosis
- **Evidence:** A read-only PowerShell search included `scripts/run-preview-acceptance.ts`, but that file is not present in the checkout. The command stopped before reading any provider data.
- **Impact:** No application, database, Worker, GitHub, or provider state changed.
- **Resolution:** Use the repository's actual controller and provider-driver paths discovered from the checkout; do not infer filenames from an older workflow description.
- **Prevention:** Enumerate the relevant tracked scripts before issuing path-specific diagnostics.
