-- Phase C owner-scoped protected follow-up records for deterministic planning.
create table secretary_follow_ups (
  id text primary key,
  owner_id text not null,
  title_envelope bytea not null,
  source_fact_ids_envelope bytea not null,
  due_at timestamptz,
  time_zone text not null,
  status text not null,
  snoozed_until timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz,
  unique (owner_id, id),
  check (owner_id <> ''),
  check (time_zone <> ''),
  check (status in ('open', 'snoozed', 'completed')),
  check ((status = 'completed') = (completed_at is not null)),
  check ((status = 'snoozed') = (snoozed_until is not null)),
  check (updated_at >= created_at),
  check (completed_at is null or completed_at >= created_at),
  check (snoozed_until is null or snoozed_until > updated_at)
);

create index secretary_follow_ups_owner_due_idx
  on secretary_follow_ups (owner_id, due_at);
