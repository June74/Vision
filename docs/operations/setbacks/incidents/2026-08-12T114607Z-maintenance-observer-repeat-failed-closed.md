# SB-20260812-114607 — CI maintenance observer repeated failed-closed

- **Status:** awaiting diagnosis
- **Detected:** 2026-08-12T11:46:07Z
- **Area:** Phase B permanent maintenance baseline / GitHub observer
- **Evidence:** A second fresh read-only observer, pinned to the full branch tip and the 2026-08-12T11:45:00Z boundary after the token replacement, reached observer_ready and returned failed_closed with exit code 1.
- **Context:** A local read-only tail at the preceding boundary captured outcome=succeeded, category=none, repair reserved, and renewal completed. Earlier GitHub run classification showed no auth, permission, or HTTP marker.
- **Impact:** No deployment, database, R2, Queue, backup-key, Worker configuration, or application state mutation occurred. The CI maintenance gate remains unaccepted.
- **Next action:** Classify this newest GitHub run using only safe job/log markers. Do not rotate credentials, change provider configuration, or deploy while the failure boundary is still unclassified.
