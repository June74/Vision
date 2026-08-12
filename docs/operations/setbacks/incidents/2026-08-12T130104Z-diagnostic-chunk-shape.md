# SB-20260812-130104 — Consumer diagnostic line was not robust to chunk framing

- **Status:** contained
- **Detected:** 2026-08-12T13:01:04Z
- **Area:** Phase B CI tail-supervisor diagnosis
- **Evidence:** The observer completed at the 13:00 boundary as `consumer_nonzero`, but no fixed consumer category reached the supervisor. The parser required the entire stderr chunk to equal one category line, which is not guaranteed by stream chunk framing.
- **Impact:** No provider, deployment, credential, database, or key state changed; only the diagnostic category was lost.
- **Resolution:** Match only the allowlisted category substring within each bounded stderr chunk; arbitrary child/provider text remains ignored.
- **Prevention:** Never assume stream chunks align to line boundaries; parse only bounded fixed tokens.
