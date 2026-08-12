# SB-20260812-120700 — Same-family valid-tail hypothesis rejected

- **Status:** contained
- **Detected:** 2026-08-12T12:07:00Z
- **Area:** Phase B maintenance observer diagnosis
- **Evidence:** A TDD RED test checked whether a valid maintenance terminal from a different quarter-hour was treated as fatal. The test reached the unimplemented helper and failed as expected, but source tracing then showed the live path already ignores any classifiable same-family record whose expectation does not match; only malformed/unclassifiable records enter the fatal branch.
- **Impact:** The test was removed before any production change. No application, provider, deployment, secret, database, or calendar state changed.
- **Conclusion:** Do not change the safe-tail classifier for this hypothesis. The repeated CI failure remains upstream of a classifiable terminal record and needs a provider/CI transport diagnosis.
- **Prevention:** Trace the complete call path before changing a privacy-safe classifier; a RED test alone does not establish that the suspected branch is reachable.
