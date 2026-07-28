# `src/domain/operations/phase-b-privilege-manifest.ts`

Defines the closed shape for controller-attested Phase B database privileges.
The production manifest contains the exact reviewed live attestation and is
deeply frozen so its schema and table facts cannot be changed at runtime.

## `freezeAttestedTable`

Applies the closed table contract and freezes one explicit table entry.

## `freezeAttestedTables`

Freezes the complete ordered table collection.

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
