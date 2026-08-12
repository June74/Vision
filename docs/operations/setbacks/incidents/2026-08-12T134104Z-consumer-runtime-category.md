# SB-20260812-134104 — Consumer runtime failures had no safe category

- **Status:** contained
- **Detected:** 2026-08-12T13:41:04Z
- **Area:** Phase B CI tail-supervisor diagnosis
- **Evidence:** Repeated CI observers returned generic `consumer_nonzero` with no allowlisted category. The supervisor intentionally discards consumer stderr, and the observer had no fixed handler for an uncaught line-handler exception or rejected promise.
- **Impact:** No provider, deployment, credential, database, or key state changed; only failure classification was incomplete.
- **Resolution:** Add an uncaught-exception/unhandled-rejection handler that emits only `observer_runtime_error` in diagnostic mode.
- **Prevention:** Every privacy-safe child must convert unexpected runtime failure into a closed safe category before process exit.
