# SB-20260727-202158-neon-leaf-url-extraction-empty: Leaf-only Neon URL extraction found no complete candidate

- **Status:** closed
- **First observed:** 2026-07-27T20:21:58Z
- **Last observed:** 2026-07-27T20:21:58Z
- **Phase/task:** Phase B restore Task 4 diagnosis
- **Environment:** Neon disposable-branch connection modal
- **Version/commit:** normal runtime ref `40872a5`

## Symptom

After selecting the approved application role and revealing the password, an
extractor limited to leaf elements found no complete unmasked PostgreSQL URL.

## Impact

No connection value was captured or printed. Direct aggregate diagnosis is
delayed.

## Cause classification

- **Working hypothesis:** Neon splits or nests the visible connection snippet
  across non-leaf elements in this modal rendering.
- **Known exclusions:** The application role is visibly selected and the
  password-reveal control succeeded.

## Correction and prevention

- **Correction:** Extract complete URL-shaped tokens across modal text/values,
  deduplicate them, and accept exactly one unmasked token with required SSL
  parameters.
- **Prevention:** Do not assume provider code snippets are stored in a single
  leaf element.

## Verification and related work

The modal contained one wrapped URL-shaped span. Removing only its five
layout whitespace characters produced one URL that passed closed validation
for protocol, hostname, application role, nonempty password, required SSL, and
absence of mask characters. The value remained private.
