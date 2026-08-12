# SB-20260812-115219 — Correlation artifact parser assumed the wrong shape

- **Status:** contained
- **Detected:** 2026-08-12T11:52:19Z
- **Area:** Phase B maintenance observer diagnosis
- **Evidence:** A private read-only artifact check downloaded the dispatch-correlation file, but the parser assumed newline-delimited key/value text while the artifact is one JSON record. It returned only safe nulls and printed no content.
- **Impact:** No provider, repository, deployment, secret, database, or application state changed; the temporary directory was removed.
- **Resolution:** Parse the artifact as one bounded JSON object and report only allowlisted field-presence/match booleans.
- **Prevention:** Inspect file shape through a bounded JSON parse before selecting a projection.
