# SB-20260812-131004 — Fixed consumer diagnostic could be lost before exit

- **Status:** contained
- **Detected:** 2026-08-12T13:10:04Z
- **Area:** Phase B CI tail-supervisor diagnosis
- **Evidence:** The observer continued to return generic `consumer_nonzero` with no fixed consumer category in CI, while local focused tests produced the category. The consumer wrote the category and immediately closed its streams without waiting for the stderr pipe flush callback.
- **Impact:** No provider, deployment, credential, database, or key state changed; only diagnostic observability was incomplete.
- **Resolution:** Complete the observer process only after the fixed diagnostic write callback fires; the callback carries no provider or tail data.
- **Prevention:** Treat privacy-safe diagnostic writes as part of the process completion contract and test their captured output.
