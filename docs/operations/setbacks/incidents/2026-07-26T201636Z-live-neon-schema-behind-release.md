# SB-20260726-201636-live-neon-schema-behind-release: Live Neon schema was behind the Phase B release

- **Status:** closed
- **First observed:** 2026-07-26T20:16:36.508530Z
- **Last observed:** 2026-07-26T21:58:19.6876526Z
- **Phase/task:** Phase B live recovery and diagnostics
- **Environment:** Live preview Neon database
- **Version/commit:** Worker `3935500`; schema is earlier than migration 9

## Symptom

A read-only schema check found 11 required Phase B tables absent from the preview database.

## Impact

Foundation diagnostics were unavailable and scheduled backup export could not
complete until reviewed migrations 0004 through 0009 and their grants were
applied.

## Reproduction conditions

Run the current authenticated foundation UI and scheduled backup against a
database that has not received all repository migrations, then compare the
public schema to the fixed migration-9 backup table contract.

## Safe evidence

A read-only query found 19 public tables total and 11 of the 29 required
migration-9 tables absent. Only fixed schema names and aggregate counts were
examined.

## Attempts and outcomes

- The live foundation UI truthfully showed its unavailable state.
- The every-minute backup trigger became visible but produced no R2 object.
- A read-only schema count and exact expected-table comparison confirmed the
  missing release tables.

## Cause classification

- **Confirmed cause:** The deployed Worker expected migration 9 while the live
  preview database was missing migrations 0004 through 0009.
- **Hypotheses:** None recorded.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** Authentication and calendar setup still load; the
  Worker deployment, bindings, backup secret presence, and cron trigger are
  current.

## Correction and prevention

- **Correction:** Applied reviewed migrations 0004 through 0009 as one
  transaction after explicit approval.
- **Prevention:** Add a guarded release-time schema-version assertion before a
  Worker deployment can be accepted.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Rerun live diagnostics and backup.

## Verification and related work

The post-migration read-only schema check found all eleven required tables and
all nine required signature columns, returning the exact
`VISION_SCHEMA_0009_OK` marker and no mismatch marker.

## Recurrence history

- 2026-07-26T20:16:36.508530Z: First observed.
- 2026-07-26T21:58:19.6876526Z: Closed after the authorized migration
  transaction and post-migration schema verification.
