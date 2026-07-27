# SB-20260727-012329-gateway-helper-references-missing: Gateway helper references were missing

- **Status:** closed
- **First observed:** 2026-07-27T01:23:29Z
- **Last observed:** 2026-07-27T01:23:29Z
- **Phase/task:** Phase B read-only Gateway acceptance
- **Environment:** Local documentation gate
- **Version/commit:** `b055ca9`

## Symptom

Documentation coverage rejected two newly named helper functions.

## Impact

The change could not pass the repository gate until both mirrored reference
documents were updated. Runtime and provider state were unchanged.

## Cause classification

- **Confirmed cause:** The implementation added named helpers without adding
  their required simple and technical headings in the same edit.
- **Known exclusions:** The focused behavior tests passed.

## Correction and prevention

- **Correction:** Add both helper headings and describe the read-only exact-rule
  acceptance path in the mirrored references.
- **Prevention:** When extracting a named production helper, update both
  reference files before running the documentation gate.

## Verification and related work

Documentation coverage, TypeScript, and all ten focused Gateway tests passed.
