-- Adds race-safe Google notification channel lifecycle and scheduled maintenance metadata.
alter table sync_channels
  alter column provider_resource_id drop not null,
  add column lifecycle text not null default 'active',
  add column created_at timestamptz not null default now(),
  add column activated_at timestamptz default now(),
  add column retired_at timestamptz,
  add column failure_count integer not null default 0,
  add column last_failure_at timestamptz;

update sync_channels
set activated_at = created_at
where lifecycle = 'active' and activated_at is null;

alter table sync_channels
  add constraint sync_channels_lifecycle_valid
    check (lifecycle in ('pending', 'active', 'retired', 'failed')),
  add constraint sync_channels_resource_lifecycle_consistent
    check (
      (lifecycle in ('active', 'retired') and provider_resource_id is not null)
      or lifecycle in ('pending', 'failed')
    ),
  add constraint sync_channels_activation_consistent
    check (
      (lifecycle = 'active' and activated_at is not null and retired_at is null)
      or (lifecycle = 'retired' and activated_at is not null and retired_at is not null)
      or lifecycle in ('pending', 'failed')
    ),
  add constraint sync_channels_failure_count_non_negative
    check (failure_count >= 0);

create index sync_channels_renewal_idx
  on sync_channels (
    owner_id, provider, provider_calendar_id, lifecycle, expires_at
  );

revoke all on sync_channels from public;

do $migration$
begin
  if exists (select 1 from pg_roles where rolname = 'vision_app') then
    grant select, insert, update on sync_channels to vision_app;
  end if;
end
$migration$;
