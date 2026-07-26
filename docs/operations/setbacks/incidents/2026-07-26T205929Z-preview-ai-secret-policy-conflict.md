# SB-20260726-205929-preview-ai-secret-policy-conflict: Preview AI key policy contradicted the acceptance plan

- **Status:** closed
- **First observed:** 2026-07-26T20:59:29.1874882Z
- **Last observed:** 2026-07-26T21:00:52.2014411Z
- **Phase/task:** Phase B AI live acceptance
- **Environment:** Phase B policy documentation
- **Version/commit:** `9620e06` plus uncommitted evidence records

## Symptom

The secret inventory prohibited the OpenAI provider key in preview, while the
approved AI acceptance plan requires one explicitly approved harmless preview
request using a configured preview key.

## Impact

The remaining AI cost gate cannot be configured without violating one of two
project documents. No provider key, Gateway rule, spending limit, or Worker
binding was changed.

## Reproduction conditions

Compare the OpenAI secret-inventory row with AI plan Task 5 and Recovery plan
Task 4.

## Safe evidence

The plan requires explicit approval plus a configured preview key for one
harmless request. The secret inventory's preview column currently says no.

## Attempts and outcomes

- The authoritative plan and specification references were located.
- The policy row now permits only a separate preview value after explicit AI
  acceptance approval.
- The focused workflow/policy suite passed 4/4 and documentation coverage
  passed.

## Cause classification

- **Confirmed cause:** The earlier secret inventory was not updated when the
  approved Phase B AI acceptance path was introduced.
- **Hypotheses:** None.
- **Rejected hypotheses:** The key does not belong in GitHub deployment
  workflows or client-prefixed configuration; it remains a Worker runtime
  secret.
- **Known exclusions:** No secret value was read, requested, or printed.

## Correction and prevention

- **Correction:** Updated the secret inventory to permit only an explicitly
  approved preview-only runtime value.
- **Prevention:** Add a policy test binding the secret inventory to the approved
  preview AI acceptance requirement.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The policy test failed against the old `No` row, then passed 4/4 after the
documentation update. Documentation coverage also passed.

## Recurrence history

- 2026-07-26T20:59:29.1874882Z: First observed.
- 2026-07-26T21:00:52.2014411Z: Closed after the policy and regression check
  aligned with the approved preview AI acceptance path.
