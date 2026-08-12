# SB-20260812-103300 — Second scheduled maintenance observer failed closed

- **Status:** contained
- **Detected:** 2026-08-12T10:33:00Z
- **Area:** Phase B permanent maintenance baseline
- **Symptom:** With the exact current branch tip pinned and the preview Worker reporting observability enabled, the observer reached `observer_ready`, covered the 10:30 UTC maintenance boundary, and closed `failed_closed` without one matching `calendar.maintenance` evidence record.
- **Impact:** The live maintenance gate remains unproven. This read-only attempt performed no deployment, rollback, database mutation, R2 mutation, Queue mutation, credential change, or key rotation.
- **Conclusion:** Repeating the scheduled observer is not justified until provider-side event delivery or tail classification is inspected. The dashboard toggle and deployed source configuration are not sufficient runtime evidence.
- **Next action:** Perform one bounded provider-side delivery inspection (tail availability, invocation presence, and safe event-shape classification only). If no invocation is visible, treat this as a Cloudflare schedule/observability propagation issue; if an invocation is visible without the application evidence, inspect the Worker log emission path.
