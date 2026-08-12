# SB-20260812-085330 — Maintenance search pattern rejected

- **Status:** contained
- **Detected:** 2026-08-12T08:53:30Z
- **Area:** Phase B maintenance observer diagnosis
- **Symptom:** A read-only PowerShell repository search used an unescaped `*/15` regular-expression fragment and was rejected before scanning any files.
- **Impact:** No files, provider state, or external systems were changed; the diagnosis was delayed by one command.
- **Correction:** Use literal or separately escaped search terms and continue with bounded source inspection.

