-- Versioned, owner-bound Vision calendar discovery and creation safety state.
create table calendar_setup_states (
  owner_id text primary key,
  google_subject text not null,
  setup_version integer not null,
  status text not null,
  action_required boolean not null default false,
  updated_at timestamptz not null,
  check (owner_id <> ''),
  check (google_subject <> ''),
  check (setup_version > 0),
  check (status in (
    'authenticated', 'discovering', 'awaiting_choice',
    'awaiting_confirmation', 'creating', 'connected', 'failed'
  )),
  check (action_required = (status = 'failed' and action_required))
);

create table calendar_setup_candidates (
  owner_id text not null,
  provider_calendar_id text not null,
  google_subject text not null,
  summary text not null,
  ownership_access_role text not null,
  time_zone text not null,
  provider_etag text not null,
  verified_at timestamptz not null,
  primary key (owner_id, provider_calendar_id),
  foreign key (owner_id) references calendar_setup_states (owner_id) on delete cascade,
  check (provider_calendar_id <> ''),
  check (google_subject <> ''),
  check (summary = 'Vision'),
  check (ownership_access_role = 'owner'),
  check (time_zone <> ''),
  check (provider_etag <> '')
);

create table vision_calendar_connections (
  owner_id text primary key,
  google_subject text not null,
  provider_calendar_id text not null,
  summary text not null,
  ownership_access_role text not null,
  time_zone text not null,
  provider_etag text not null,
  verified_at timestamptz not null,
  connection_kind text not null,
  unique (google_subject, provider_calendar_id),
  foreign key (owner_id) references calendar_setup_states (owner_id),
  check (provider_calendar_id <> ''),
  check (google_subject <> ''),
  check (summary = 'Vision'),
  check (ownership_access_role = 'owner'),
  check (time_zone <> ''),
  check (provider_etag <> ''),
  check (connection_kind in ('existing', 'created'))
);

alter table operation_ledger
  add column setup_version integer,
  add column result_calendar_id text,
  add constraint operation_ledger_setup_version_positive
    check (setup_version is null or setup_version > 0),
  add constraint operation_ledger_result_calendar_non_empty
    check (result_calendar_id is null or result_calendar_id <> ''),
  add constraint operation_ledger_calendar_status_valid
    check (
      operation_kind <> 'vision_calendar_create'
      or (
        setup_version is not null
        and status in ('in_progress', 'retryable', 'completed', 'action_required')
      )
    );

create unique index operation_ledger_one_unresolved_calendar_create_uq
  on operation_ledger (owner_id, operation_kind)
  where operation_kind = 'vision_calendar_create'
    and status in ('in_progress', 'retryable', 'action_required');

create table calendar_create_snapshots (
  operation_id text not null,
  owner_id text not null,
  provider_calendar_id text not null,
  primary key (operation_id, provider_calendar_id),
  foreign key (operation_id) references operation_ledger (operation_id) on delete cascade,
  check (owner_id <> ''),
  check (provider_calendar_id <> '')
);

create index calendar_create_snapshots_owner_operation_idx
  on calendar_create_snapshots (owner_id, operation_id);
