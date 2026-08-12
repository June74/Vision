# SB-20260812-115319 — Tail lifetime probe patch quoting error

- **Status:** contained
- **Detected:** 2026-08-12T11:53:19Z
- **Area:** Phase B maintenance observer diagnosis
- **Evidence:** A generated ignored-probe patch failed before application because one patch terminator line was not quoted in the orchestration script.
- **Impact:** No file, provider, deployment, or application state changed.
- **Resolution:** Recreate the probe with a shorter, explicitly quoted line array.
- **Prevention:** Keep every generated patch line as a separate quoted string.
