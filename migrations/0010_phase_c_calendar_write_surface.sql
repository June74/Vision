-- Phase C authenticated one-off write approvals and durable execution state.
create table calendar_write_approvals (
  operation_id text primary key,
  owner_id text not null,
  provider text not null,
  calendar_id text not null,
  proposal_domain text not null,
  status text not null,
  requested_at timestamptz not null,
  expires_at timestamptz not null,
  proposal_envelope bytea not null,
  unique (owner_id, operation_id),
  check (owner_id <> ''),
  check (provider = 'google'),
  check (calendar_id <> ''),
  check (proposal_domain in ('school', 'work', 'personal')),
  check (status in ('proposed', 'confirmed', 'invalidated')),
  check (expires_at > requested_at)
);

create table calendar_write_operations (
  operation_id text primary key,
  owner_id text not null,
  provider text not null,
  calendar_id text not null,
  status text not null,
  provider_event_id text,
  provider_event_version text,
  requested_at timestamptz not null,
  completed_at timestamptz,
  unique (owner_id, provider, operation_id),
  check (owner_id <> ''),
  check (provider = 'google'),
  check (calendar_id <> ''),
  check (status in ('writing', 'verification_pending', 'verified', 'failed', 'undone')),
  check ((provider_event_id is null) = (provider_event_version is null)),
  check (status not in ('verified', 'undone') or (provider_event_id is not null and provider_event_version is not null))
);
