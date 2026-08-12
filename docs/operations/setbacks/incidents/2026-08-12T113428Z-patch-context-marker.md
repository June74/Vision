# SB-20260812-113428 — Patch context marker formatting error

- **Status:** contained
- **Detected:** 2026-08-12T11:34:28Z
- **Area:** Phase B maintenance observer diagnosis
- **Evidence:** A combined generated patch omitted the leading space on an index context line and was rejected by apply_patch.
- **Impact:** No repository or provider state changed.
- **Resolution:** Split the new-file and index edits into separate minimal patches.
- **Prevention:** Mark every update-hunk context line explicitly before applying.
