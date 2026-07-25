-- Adds one durable maintenance generation and renewal election per private calendar.
create table calendar_sync_maintenance (
  owner_id text not null,
  provider text not null,
  provider_calendar_id text not null,
  connection_version integer not null,
  checkpoint_version integer not null,
  renewal_generation integer not null default 0,
  renewal_lease_id text,
  renewal_lease_expires_at timestamptz,
  renewal_failures integer not null default 0,
  current_channel_row_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (owner_id, provider, provider_calendar_id),
  constraint calendar_sync_maintenance_owner_non_empty check (owner_id <> ''),
  constraint calendar_sync_maintenance_provider_non_empty check (provider <> ''),
  constraint calendar_sync_maintenance_calendar_non_empty check (provider_calendar_id <> ''),
  constraint calendar_sync_maintenance_connection_version_positive check (connection_version > 0),
  constraint calendar_sync_maintenance_checkpoint_version_non_negative check (checkpoint_version >= 0),
  constraint calendar_sync_maintenance_generation_non_negative check (renewal_generation >= 0),
  constraint calendar_sync_maintenance_failures_non_negative check (renewal_failures >= 0),
  constraint calendar_sync_maintenance_lease_consistent check (
    (renewal_lease_id is null) = (renewal_lease_expires_at is null)
  ),
  constraint calendar_sync_maintenance_timestamps_valid check (updated_at >= created_at)
);

alter table sync_channels
  add column renewal_generation integer,
  add column renewal_lease_id text,
  add column cleanup_required boolean not null default false;

-- Close any pre-migration provisional lifecycle before enforcing one elected pending row.
update sync_channels
set lifecycle = 'failed',
    renewal_generation = 1,
    renewal_lease_id = 'legacy_' || id,
    last_failure_at = coalesce(last_failure_at, now())
where lifecycle in ('pending', 'failed');

alter table sync_channels
  add constraint sync_channels_renewal_generation_positive
    check (renewal_generation is null or renewal_generation > 0),
  add constraint sync_channels_renewal_lease_consistent
    check (
      (lifecycle in ('pending', 'failed')) = (renewal_lease_id is not null)
      or lifecycle in ('active', 'retired')
    );

create unique index sync_channels_one_pending_renewal_uq
  on sync_channels (owner_id, provider, provider_calendar_id)
  where lifecycle = 'pending';

create index sync_channels_cleanup_idx
  on sync_channels (
    owner_id, provider, provider_calendar_id, cleanup_required, lifecycle
  );

revoke all on calendar_sync_maintenance, sync_channels from public;

do $migration$
begin
  if exists (select 1 from pg_roles where rolname = 'vision_app') then
    grant select, insert, update on calendar_sync_maintenance to vision_app;
    grant select, insert, update on sync_channels to vision_app;
  end if;
end
$migration$;
