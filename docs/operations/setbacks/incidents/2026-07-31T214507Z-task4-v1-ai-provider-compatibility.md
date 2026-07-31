# SB-20260731-214507-task4-v1-ai-provider-compatibility: Task 4 compatibility repair weakened historical v1 AI provider verification

- **Status:** closed
- **First observed:** 2026-07-31T21:45:07.6159331Z
- **Last observed:** 2026-07-31T21:48:44.0535215Z
- **Phase/task:** Phase B Task 4 final package review
- **Environment:** Local sanitized source and test review
- **Version/commit:** 2cf0ff1 plus uncommitted Task 4 implementation

## Symptom

The legacy rollback path no longer requires the AI gateway-limit attestation
that historical v1 AI candidates used. Existing tests cover a v1 foundation
candidate but not a v1 AI candidate.

## Impact

A historical v1 AI candidate could fail exact provider-state classification
during rollback and remain deployed. No live workflow or provider mutation
occurred.

## Cause classification

- **Confirmed cause:** The v2/v3 compatibility repair treated every v1
  candidate as foundation-only at the provider-binding boundary.
- **Contributing cause:** The compatibility test matrix omitted a full v1 AI
  provider-state traversal.
- **Known exclusions:** No provider, network, database, secret, deployment,
  staging state, or commit changed during discovery.

## Correction and prevention

- **Correction:** Reproduce with a failing v1 AI rollback-provider test, then
  restore the exact historical v1 AI gateway-limit binding contract.
- **Prevention:** Exercise every persisted intent generation and candidate kind
  through the downstream provider verifier.
- **Owner:** Codex.
- **Next diagnostic step:** Add the minimal failing compatibility test before
  changing implementation.

## Recurrence history

- 2026-07-31T21:45:07.6159331Z: Confirmed by independent final package review;
  repair is required before Task 4 acceptance.
- 2026-07-31T21:48:44.0535215Z: Closed after the new v1 AI provider test first
  failed on the missing attestation and then all 28 focused lifecycle tests
  passed with the historical attestation requirement restored.
