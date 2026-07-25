# `src/data/schema/annotations.ts`

`nodeAnnotations` has an owner-scoped node foreign key, authenticated ciphertext, explicit key version, closed
user/system/model provenance, monotonic timestamps, and an owner/node lookup index. Provider projection code never
updates or cascades this table.

`nodeCategoryAssignments` is the normalized provenance record for the category materialized on `nodes.domain`.
It has an owner-scoped node foreign key, closed non-unresolved domain and state values, closed Vision provenance,
positive version, and an owner/domain/time index. Keeping this row separate prevents provider provenance from being
misused as category provenance.
