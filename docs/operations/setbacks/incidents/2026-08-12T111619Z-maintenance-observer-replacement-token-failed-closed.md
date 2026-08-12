# SB-20260812-111619 — Replacement-token observer still failed closed

- **Status:** contained
- **Detected:** 2026-08-12T11:16:19Z
- **Area:** Phase B permanent maintenance baseline / GitHub observer
- **Evidence:** After the preview GitHub environment token was replaced (the secret metadata update preceded this run), one fresh read-only maintenance observer was pinned to the current full branch tip and the 2026-08-12T11:15:00Z schedule boundary. The observer reached observer_ready, then returned only the safe category failed_closed with exit code 1. The latest GitHub run had successful checkout/setup, no classified 401/403/permission or HTTP marker, and an acceptance-step nonzero exit.
- **Impact:** No deployment, database, R2, Queue, backup-key, or Worker configuration mutation occurred. Phase B maintenance acceptance remains unproven.
- **Interpretation:** The run did not expose a provider-auth failure; it closed without accepted evidence. A separate local read-only probe at the next boundary captured outcome=succeeded, category=none, repair reserved, and renewal completed. The remaining uncertainty is the CI observer's event timing/correlation or a transient earlier maintenance result, not application health.
- **Next action:** Pin one new observer to the next 15-minute boundary and accept only its exact correlated result. No deployment or provider configuration change is needed.
