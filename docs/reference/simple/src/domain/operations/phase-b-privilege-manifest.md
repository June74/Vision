# `src/domain/operations/phase-b-privilege-manifest.ts`

Defines the closed shape for controller-attested Phase B database privileges.
The production manifest intentionally remains unavailable until live
attestation supplies every value.

## `isCompletePhaseBPrivilegeManifest`

Accepts only the exact role, schema, and ordered 29-table contract.

## `comparePhaseBPrivilegeFacts`

Compares two complete contracts without returning database identifiers.

## `isPrivilegeList`

Checks that privilege names use the complete canonical order.

## `isSubset`

Requires every grant option to also be an effective privilege.

## `sameStrings`

Compares two ordered text lists exactly.

## `snapshotPlainRecord`

Copies only safe own data properties from a plain object.

## `hasExactKeys`

Rejects missing, extra, hidden, accessor, symbol, or inherited fields.

## `isNonemptyText`

Accepts only nonempty text values.
