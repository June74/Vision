# `src/domain/privacy/privacy.ts`

This module centralizes the ordinal privacy invariant: `planning < private < restricted`. Inputs and outputs are strict Zod schemas to prevent unreviewed attributes from reaching policy code.

## `PrivacyLevelSchema`

The schema accepts only the canonical planning, private, and restricted values.

## `doesNotReducePrivacy`

**Signature:** `doesNotReducePrivacy(current: PrivacyLevel, proposed: PrivacyLevel): boolean`

The function compares closed-level ranks and returns true only if the proposal preserves or raises protection. It has no side effects.

## `resolvePrivacy`

**Signature:** `resolvePrivacy(input: PrivacyResolutionInput): PrivacyDecision`

For an inferred proposal below the current level, the function preserves the current level. A higher inferred level is permitted. Every result sets `sharingAuthorized` to false: a classification or privacy rule cannot grant external disclosure authority. Covered by `tests/unit/domain/graph.test.ts`.
