# SB-20260812-113625 — Observer input patch used a stale prior line

- **Status:** contained
- **Detected:** 2026-08-12T11:36:25Z
- **Area:** Phase B maintenance observer diagnosis
- **Evidence:** A read-only patch expected the ignored observer input to still contain the earlier abbreviated-tip/10:30-era line. The file already held the full current tip and 11:15 boundary, so apply_patch rejected the mismatch.
- **Impact:** No repository, provider, deployment, or observer state changed.
- **Resolution:** Read the current ignored input before updating it to the next boundary.
- **Prevention:** Never patch ignored run context from an old snapshot after a retry.
