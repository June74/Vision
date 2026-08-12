# SB-20260812-140304 — Consumer close raced its final diagnostic chunk

- **Status:** contained
- **Detected:** 2026-08-12T14:03:04Z
- **Area:** Phase B CI tail-supervisor diagnosis
- **Evidence:** The final observer still returned generic `consumer_nonzero`; local review showed the supervisor selected the fallback category immediately on the consumer `close` event, before a final stderr data chunk could be classified. The diagnostic parser also did not retain a bounded suffix across chunk boundaries.
- **Impact:** No provider, deployment, credential, database, or key state changed; only the fixed failure category could be lost.
- **Resolution:** Retain only a bounded diagnostic suffix and defer consumer-close classification by one event-loop turn.
- **Prevention:** Treat child stdout/stderr close ordering as asynchronous and test immediate nonzero exits carrying a fixed category.
