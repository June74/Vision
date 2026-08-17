-- Phase C owner-scoped local secretary capture, task, and note records.
create table secretary_captures (
  id text primary key,
  owner_id text not null,
  kind text not null,
  ambiguity text not null,
  content_envelope bytea not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (owner_id, id),
  check (owner_id <> ''),
  check (kind in ('task', 'note', 'calendar_candidate', 'ambiguous')),
  check (ambiguity in ('none', 'needs_clarification')),
  check (updated_at >= created_at)
);

create index secretary_captures_owner_created_idx
  on secretary_captures (owner_id, created_at);

create table secretary_tasks (
  id text primary key,
  owner_id text not null,
  title_envelope bytea not null,
  due_at timestamptz,
  time_zone text not null,
  status text not null,
  created_at timestamptz not null,
  completed_at timestamptz,
  unique (owner_id, id),
  check (owner_id <> ''),
  check (time_zone <> ''),
  check (status in ('open', 'completed')),
  check ((status = 'completed') = (completed_at is not null)),
  check (completed_at is null or completed_at >= created_at)
);

create index secretary_tasks_owner_due_idx
  on secretary_tasks (owner_id, due_at);

create table secretary_notes (
  id text primary key,
  owner_id text not null,
  title_envelope bytea not null,
  body_envelope bytea not null,
  status text not null default 'active',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (owner_id, id),
  check (owner_id <> ''),
  check (status = 'active'),
  check (updated_at >= created_at)
);

create index secretary_notes_owner_updated_idx
  on secretary_notes (owner_id, updated_at);
