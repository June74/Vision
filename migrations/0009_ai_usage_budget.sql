-- Adds content-free, append-only AI usage accounting and one-owner concurrency control.
create table ai_usage_months (
  owner_id text not null,
  budget_month text not null,
  settled_cents integer not null default 0,
  reserved_cents integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (owner_id, budget_month),
  constraint ai_usage_months_owner_non_empty check (owner_id <> ''),
  constraint ai_usage_months_key_valid
    check (budget_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint ai_usage_months_settled_non_negative check (settled_cents >= 0),
  constraint ai_usage_months_reserved_non_negative check (reserved_cents >= 0),
  constraint ai_usage_months_timestamps_valid check (updated_at >= created_at)
);

create table ai_usage_reservations (
  id text primary key,
  owner_id text not null,
  budget_month text not null,
  idempotency_key text not null,
  request_class text not null,
  status text not null,
  estimated_cents integer not null,
  actual_cents integer,
  provider_request_id text,
  model_id text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  dispatched_at timestamptz,
  completed_at timestamptz,
  constraint ai_usage_reservations_owner_idempotency_uq
    unique (owner_id, budget_month, idempotency_key),
  constraint ai_usage_reservations_owner_non_empty check (owner_id <> ''),
  constraint ai_usage_reservations_idempotency_non_empty check (idempotency_key <> ''),
  constraint ai_usage_reservations_month_valid
    check (budget_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint ai_usage_reservations_class_valid
    check (request_class in ('routine', 'optional', 'complex')),
  constraint ai_usage_reservations_status_valid
    check (status in ('reserved', 'dispatched', 'settled', 'settled_estimate', 'released')),
  constraint ai_usage_reservations_estimate_positive check (estimated_cents > 0),
  constraint ai_usage_reservations_actual_non_negative
    check (actual_cents is null or actual_cents >= 0),
  constraint ai_usage_reservations_token_counts_non_negative check (
    (input_tokens is null or input_tokens >= 0)
    and (output_tokens is null or output_tokens >= 0)
    and (total_tokens is null or total_tokens >= 0)
  ),
  constraint ai_usage_reservations_expiry_after_created
    check (expires_at > created_at),
  constraint ai_usage_reservations_dispatch_consistent check (
    (status in ('dispatched', 'settled', 'settled_estimate'))
    = (dispatched_at is not null)
  ),
  constraint ai_usage_reservations_completion_consistent check (
    (status in ('settled', 'settled_estimate', 'released'))
    = (completed_at is not null)
  ),
  constraint ai_usage_reservations_actual_consistent check (
    (status in ('settled', 'settled_estimate'))
    = (actual_cents is not null)
  ),
  constraint ai_usage_reservations_timestamps_valid check (
    (dispatched_at is null or dispatched_at >= created_at)
    and (completed_at is null or completed_at >= created_at)
  )
);

create unique index ai_usage_reservations_one_in_flight_uq
  on ai_usage_reservations (owner_id)
  where status in ('reserved', 'dispatched');

create index ai_usage_reservations_expiry_idx
  on ai_usage_reservations (status, expires_at);

create table ai_usage_ledger (
  id text primary key,
  reservation_id text not null,
  owner_id text not null,
  budget_month text not null,
  event_type text not null,
  estimated_cents integer not null,
  actual_cents integer,
  provider_request_id text,
  model_id text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  occurred_at timestamptz not null,
  constraint ai_usage_ledger_reservation_fk
    foreign key (reservation_id) references ai_usage_reservations (id),
  constraint ai_usage_ledger_owner_non_empty check (owner_id <> ''),
  constraint ai_usage_ledger_month_valid
    check (budget_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint ai_usage_ledger_event_valid
    check (event_type in ('reserved', 'dispatched', 'settled', 'settled_estimate', 'released')),
  constraint ai_usage_ledger_estimate_positive check (estimated_cents > 0),
  constraint ai_usage_ledger_actual_non_negative
    check (actual_cents is null or actual_cents >= 0),
  constraint ai_usage_ledger_token_counts_non_negative check (
    (input_tokens is null or input_tokens >= 0)
    and (output_tokens is null or output_tokens >= 0)
    and (total_tokens is null or total_tokens >= 0)
  )
);

create index ai_usage_ledger_owner_month_occurred_idx
  on ai_usage_ledger (owner_id, budget_month, occurred_at);

revoke all on ai_usage_months, ai_usage_reservations, ai_usage_ledger from public;

do $migration$
begin
  if exists (select 1 from pg_roles where rolname = 'vision_app') then
    grant select, insert, update on ai_usage_months to vision_app;
    grant select, insert, update on ai_usage_reservations to vision_app;
    grant select, insert on ai_usage_ledger to vision_app;
  end if;
end
$migration$;
