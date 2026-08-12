# SB-20260812-095037 — Preview build environment omitted during artifact inspection

- **Status:** contained
- **Detected:** 2026-08-12T09:50:37Z
- **Area:** Phase B preview observability configuration
- **Symptom:** The first local build was run without `CLOUDFLARE_ENV=preview`, so the generated artifact represented the local environment and did not contain preview-only observability settings.
- **Impact:** No deployment occurred from that artifact and no provider state changed. The discrepancy delayed deployment until a correctly targeted preview build was produced and inspected.
- **Correction:** Set `CLOUDFLARE_ENV=preview` before every preview build, verify the flattened artifact contains the expected observability/binding/schedule contract, then run the preview deploy validator.

