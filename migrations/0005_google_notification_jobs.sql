-- Adds digest-verified Google notification ingestion and claim-guarded queue jobs.
alter table sync_channels
  add column verification_token_hash text,
  add constraint sync_channels_token_hash_valid
    check (
      verification_token_hash is null
      or verification_token_hash ~ '^[A-Za-z0-9_-]{43}$'
    );

create unique index sync_channels_provider_channel_lookup_uq
  on sync_channels (provider, provider_channel_id);

create table calendar_sync_jobs (
  job_id text primary key,
  owner_id text not null,
  provider text not null,
  provider_calendar_id text not null,
  reason text not null,
  status text not null,
  attempts integer not null default 0,
  claim_id text,
  claimed_at timestamptz,
  completed_at timestamptz,
  last_error_category text,
  action_required boolean not null default false,
  checkpoint_version integer,
  page_count integer,
  staged_count integer,
  upserted_count integer,
  deleted_count integer,
  unchanged_count integer,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint calendar_sync_jobs_owner_non_empty check (owner_id <> ''),
  constraint calendar_sync_jobs_provider_non_empty check (provider <> ''),
  constraint calendar_sync_jobs_calendar_non_empty check (provider_calendar_id <> ''),
  constraint calendar_sync_jobs_reason_valid
    check (reason in ('initial', 'manual', 'push', 'rebuild', 'repair')),
  constraint calendar_sync_jobs_status_valid
    check (
      status in (
        'pending_enqueue', 'enqueued', 'in_progress',
        'retry_scheduled', 'succeeded', 'failed'
      )
    ),
  constraint calendar_sync_jobs_attempts_non_negative check (attempts >= 0),
  constraint calendar_sync_jobs_claim_consistent
    check (
      (status = 'in_progress' and claim_id is not null and claimed_at is not null)
      or
      (status <> 'in_progress' and claim_id is null)
    ),
  constraint calendar_sync_jobs_error_category_valid
    check (
      last_error_category is null
      or last_error_category in (
        'authorization', 'concurrency', 'database', 'provider',
        'payload_too_large', 'quota', 'schema', 'sync_token_invalid', 'transient'
      )
    ),
  constraint calendar_sync_jobs_checkpoint_positive
    check (checkpoint_version is null or checkpoint_version > 0),
  constraint calendar_sync_jobs_counts_non_negative
    check (
      (page_count is null or page_count > 0)
      and (staged_count is null or staged_count >= 0)
      and (upserted_count is null or upserted_count >= 0)
      and (deleted_count is null or deleted_count >= 0)
      and (unchanged_count is null or unchanged_count >= 0)
    ),
  constraint calendar_sync_jobs_completed_consistent
    check (
      (status in ('succeeded', 'failed')) = (completed_at is not null)
    ),
  constraint calendar_sync_jobs_action_required_terminal
    check (not action_required or status = 'failed'),
  constraint calendar_sync_jobs_timestamps_valid
    check (
      updated_at >= created_at
      and (claimed_at is null or claimed_at >= created_at)
      and (completed_at is null or completed_at >= created_at)
    )
);

create index calendar_sync_jobs_owner_calendar_updated_idx
  on calendar_sync_jobs (
    owner_id, provider, provider_calendar_id, updated_at desc
  );

revoke all on calendar_sync_jobs, sync_channels from public;

do $migration$
begin
  if exists (select 1 from pg_roles where rolname = 'vision_app') then
    grant select, insert, update on calendar_sync_jobs to vision_app;
    grant select, insert, update on sync_channels to vision_app;
  end if;
end
$migration$;
