-- Adds the CAS checkpoint and encrypted provider projection required by paginated event synchronization.
alter table sync_checkpoints
  drop constraint if exists sync_checkpoints_key_version_non_empty,
  drop constraint if exists sync_checkpoints_key_version_check,
  alter column sync_token_envelope drop not null,
  alter column key_version drop not null,
  alter column key_version type integer using key_version::integer,
  add column version integer not null default 0,
  add column status text not null default 'pending',
  add column last_error_category text,
  add column updated_at timestamptz not null default now();

update sync_checkpoints
set
  version = case when sync_token_envelope is null then 0 else 1 end,
  status = case when sync_token_envelope is null then 'pending' else 'connected' end,
  updated_at = committed_at;

alter table sync_checkpoints
  add constraint sync_checkpoints_version_non_negative check (version >= 0),
  add constraint sync_checkpoints_key_version_positive
    check (key_version is null or key_version > 0),
  add constraint sync_checkpoints_status_valid
    check (status in ('pending', 'connected', 'disconnected', 'action_required', 'rebuild_required', 'retry_scheduled')),
  add constraint sync_checkpoints_error_category_valid
    check (
      last_error_category is null
      or last_error_category in (
        'authorization', 'concurrency', 'database', 'provider',
        'schema', 'sync_token_invalid', 'transient'
      )
    ),
  add constraint sync_checkpoints_token_version_consistent
    check (
      (version = 0 and sync_token_envelope is null and key_version is null)
      or
      (version > 0 and sync_token_envelope is not null and key_version is not null and key_version > 0)
    );

create table event_sync_payloads (
  node_id text not null,
  owner_id text not null,
  protected_payload_envelope bytea not null,
  protected_key_version integer not null,
  primary key (node_id),
  constraint event_sync_payloads_event_owner_fk
    foreign key (node_id, owner_id) references events (node_id, owner_id) on delete cascade,
  constraint event_sync_payloads_key_version_positive
    check (protected_key_version > 0)
);

create table sync_runs (
  job_id text primary key,
  owner_id text not null,
  provider text not null,
  provider_calendar_id text not null,
  reason text not null,
  page_count integer not null,
  staged_count integer not null,
  upserted_count integer not null,
  deleted_count integer not null,
  unchanged_count integer not null,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  checkpoint_version integer not null,
  constraint sync_runs_owner_non_empty check (owner_id <> ''),
  constraint sync_runs_provider_non_empty check (provider <> ''),
  constraint sync_runs_calendar_non_empty check (provider_calendar_id <> ''),
  constraint sync_runs_reason_valid
    check (reason in ('initial', 'manual', 'push', 'rebuild', 'repair')),
  constraint sync_runs_page_count_positive check (page_count > 0),
  constraint sync_runs_staged_count_non_negative check (staged_count >= 0),
  constraint sync_runs_upserted_count_non_negative check (upserted_count >= 0),
  constraint sync_runs_deleted_count_non_negative check (deleted_count >= 0),
  constraint sync_runs_unchanged_count_non_negative check (unchanged_count >= 0),
  constraint sync_runs_completed_after_started check (completed_at >= started_at),
  constraint sync_runs_checkpoint_version_positive check (checkpoint_version > 0)
);

create index sync_runs_owner_calendar_completed_idx
  on sync_runs (owner_id, provider, provider_calendar_id, completed_at desc);

revoke all on event_sync_payloads, sync_runs from public;

do $migration$
begin
  if exists (select 1 from pg_roles where rolname = 'vision_app') then
    grant select, insert, update, delete on event_sync_payloads to vision_app;
    grant select, insert on sync_runs to vision_app;
    grant select, insert, update on sync_checkpoints to vision_app;
  end if;
end
$migration$;
