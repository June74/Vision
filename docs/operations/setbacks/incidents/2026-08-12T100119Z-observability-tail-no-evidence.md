# SB-20260812-100119 — Post-observability deploy tail still had no maintenance evidence

- **Status:** contained
- **Detected:** 2026-08-12T10:01:19Z
- **Area:** Phase B permanent maintenance baseline
- **Symptom:** After deploying the preview artifact with observability enabled, a privacy-safe tail remained connected through the 10:00 UTC maintenance tick but ended without an allowlisted maintenance result.
- **Impact:** The live maintenance gate remains unproven. Health, deployment, R2, Queue, secret-name, and schedule state were not changed by this observation.
- **Likely boundary:** The provider-side setting has not propagated, is not accepted for this Worker/account, or the deployed schedule invocation is not reaching the tail stream. The source config and generated artifact are locally validated.
- **Next action:** Inspect only the provider settings/dashboard state and current tail availability; do not perform another blind scheduled retry until that state is known.

