# Calendar-write schema

`src/data/schema/calendar-write.ts` mirrors
`migrations/0010_phase_c_calendar_write_surface.sql`.

The approval table has a primary operation ID, owner/provider/calendar scope,
controlled `proposal_domain`, approval status, timezone-aware requested/expiry
timestamps, and the existing `ciphertext("proposal_envelope")` column. The
domain is key-selection metadata only; protected event content remains inside
the envelope.

The approval table additionally stores the allowlisted action, paired nullable
`provider_event_id`/`provider_event_version` for non-create mutations, and
`mutation_scope`. Database checks enforce the action allowlist, paired identity,
create-versus-mutation identity semantics, and `single | series` scope. The
current contract persists only `single`; series behavior is deferred to the
recurrence increment.

The execution table has a separate primary operation ID, owner/provider/
calendar scope, execution status, nullable provider event ID/version,
requested/completed timestamps, an owner/provider/operation uniqueness key, and
checks that pair identity/version and require both for `verified` or `undone`.
No Phase B table is dropped, recreated, or rewritten by this migration.
