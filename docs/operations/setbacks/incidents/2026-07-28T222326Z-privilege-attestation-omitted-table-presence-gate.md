# SB-20260728-222326-privilege-attestation-omitted-table-presence-gate: Privilege attestation omitted the table-presence gate

- **Status:** closed
- **First observed:** 2026-07-28T22:23:26.3813087Z
- **Last observed:** 2026-07-28T22:27:05.2738294Z
- **Phase/task:** Phase B acceptance instrumentation Task 3 live privilege manifest
- **Environment:** Local Phase B worktree against preview Neon
- **Version/commit:** `4c619f2`

## Symptom

The local read-only privilege helper returned a safe success marker after
querying 29 expected table names, but its final admission did not require each
catalog row to report that the corresponding table was present.

## Impact

No database mutation or private-data exposure occurred. The generated local
attestation was quarantined before production code used it, and the Task 3
implementer was paused. Without correction, a missing table could have been
represented by a catalog placeholder and incorrectly admitted into the
privilege manifest.

## Reproduction conditions

Run the scratch privilege helper when its row-count and uniqueness checks are
present but its final gate does not require every admitted row's
`table_present` fact to be true.

## Safe evidence

The helper source included a `table_present` fact in each admitted row, while
the final validation checked only row count and unique expected names. A
controller-side safe summary showed the gap before any manifest edit began.
The connection string was neither printed nor stored.

## Attempts and outcomes

- The first live query completed read-only and wrote an ignored local
  attestation file.
- The implementer handoff was paused before the attestation was read or used.
- The helper was corrected to require every expected table to be present, the
  quarantined output was removed, and a fresh live read-only attestation
  passed its closed gate.

## Cause classification

- **Confirmed cause:** The scratch helper's final admission omitted an
  all-tables-present predicate.
- **Hypotheses:** None.
- **Rejected hypotheses:** A successful 29-row count does not prove that all
  relations exist because the query intentionally starts from the expected
  table-name set and left joins the catalog.
- **Known exclusions:** No database write, secret output, production-code
  change, or implementer change occurred.

## Correction and prevention

- **Correction:** Require every expected catalog row to be present before
  saving an attestation, delete the quarantined file, and rerun the read-only
  query.
- **Prevention:** Every expected-set catalog attestation must separately
  validate cardinality, uniqueness, and existence; row count alone is never
  sufficient after a left join.
- **Owner:** Codex.
- **Next diagnostic step:** None while the corrected attestation remains the
  Task 3 input.

## Verification and related work

`node --check` passed for the corrected helper. The quarantined file was
removed before rerunning. The fresh live query emitted only
`PRIVILEGE_ATTESTATION_SAVED`, and a safe local summary confirmed the exact
role, schema, 29 unique tables, one non-application owner, zero public table
grants, and zero grant-option-bearing tables.

## Recurrence history

- 2026-07-28T22:23:26.3813087Z: First observed and contained before use.
- 2026-07-28T22:27:05.2738294Z: Corrected helper and fresh live attestation
  verified; incident closed.
