# SB-20260812-095319 — Post-deploy health probe blocked by local network sandbox

- **Status:** contained
- **Detected:** 2026-08-12T09:53:19Z
- **Area:** Phase B post-deploy verification
- **Symptom:** The first value-free HTTPS health probe could not connect from the restricted local network boundary.
- **Impact:** The probe returned no application response; deployment state was unchanged and no provider mutation occurred.
- **Correction:** Repeat the same read-only health request with the required external-network approval and validate only the fixed health contract.

