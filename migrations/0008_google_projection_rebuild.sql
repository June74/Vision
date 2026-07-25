-- Adds ciphertext-only rebuild staging and first-party annotations preserved across provider projection replacement.
create table node_annotations (
  id text primary key,
  owner_id text not null,
  node_id text not null,
  provenance text not null,
  annotation_envelope bytea not null,
  key_version integer not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint node_annotations_node_owner_fk
    foreign key (node_id, owner_id) references nodes (id, owner_id),
  constraint node_annotations_owner_non_empty check (owner_id <> ''),
  constraint node_annotations_provenance_valid
    check (provenance in ('user', 'system', 'model')),
  constraint node_annotations_key_version_positive check (key_version > 0),
  constraint node_annotations_timestamps_valid check (updated_at >= created_at)
);

create index node_annotations_owner_node_idx
  on node_annotations (owner_id, node_id, updated_at desc);

create table node_category_assignments (
  node_id text not null,
  owner_id text not null,
  domain text not null,
  domain_state text not null,
  provenance text not null,
  assigned_at timestamptz not null,
  version integer not null,
  primary key (node_id),
  constraint node_category_assignments_node_owner_fk
    foreign key (node_id, owner_id) references nodes (id, owner_id),
  constraint node_category_assignments_domain_valid
    check (domain in ('school', 'work', 'personal')),
  constraint node_category_assignments_state_valid
    check (domain_state in ('confirmed', 'inferred')),
  constraint node_category_assignments_provenance_valid
    check (provenance in ('user', 'system', 'model')),
  constraint node_category_assignments_version_positive check (version > 0)
);

create index node_category_assignments_owner_domain_idx
  on node_category_assignments (owner_id, domain, assigned_at desc);

create table projection_rebuild_generations (
  id text primary key,
  owner_id text not null,
  provider text not null,
  provider_calendar_id text not null,
  job_id text not null,
  queue_claim_id text,
  base_checkpoint_version integer not null,
  status text not null,
  page_count integer,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  activated_at timestamptz,
  constraint projection_rebuild_generations_job_unique
    unique (owner_id, provider, provider_calendar_id, job_id),
  constraint projection_rebuild_generations_owner_non_empty check (owner_id <> ''),
  constraint projection_rebuild_generations_provider_valid
    check (provider = 'google-calendar'),
  constraint projection_rebuild_generations_calendar_non_empty
    check (provider_calendar_id <> ''),
  constraint projection_rebuild_generations_job_non_empty check (job_id <> ''),
  constraint projection_rebuild_generations_claim_non_empty
    check (queue_claim_id is null or queue_claim_id <> ''),
  constraint projection_rebuild_generations_base_version_positive
    check (base_checkpoint_version > 0),
  constraint projection_rebuild_generations_status_valid
    check (status in ('staging', 'ready', 'activated', 'abandoned')),
  constraint projection_rebuild_generations_page_count_valid
    check (page_count is null or page_count > 0),
  constraint projection_rebuild_generations_activation_consistent
    check ((status = 'activated') = (activated_at is not null)),
  constraint projection_rebuild_generations_timestamps_valid
    check (
      updated_at >= created_at
      and (activated_at is null or activated_at >= created_at)
    )
);

create index projection_rebuild_generations_cleanup_idx
  on projection_rebuild_generations (status, updated_at);

create table projection_rebuild_changes (
  generation_id text not null,
  identity_hash text not null,
  ordinal integer not null,
  planning_json jsonb not null,
  protected_payload_envelope bytea,
  protected_key_version integer,
  primary key (generation_id, identity_hash),
  constraint projection_rebuild_changes_generation_fk
    foreign key (generation_id) references projection_rebuild_generations (id)
    on delete cascade,
  constraint projection_rebuild_changes_generation_ordinal_unique
    unique (generation_id, ordinal),
  constraint projection_rebuild_changes_identity_hash_valid
    check (identity_hash ~ '^[A-Za-z0-9_-]{43}$'),
  constraint projection_rebuild_changes_ordinal_non_negative check (ordinal >= 0),
  constraint projection_rebuild_changes_payload_consistent
    check (
      (protected_payload_envelope is null and protected_key_version is null)
      or
      (protected_payload_envelope is not null and protected_key_version > 0)
    )
);

create index projection_rebuild_changes_generation_ordinal_idx
  on projection_rebuild_changes (generation_id, ordinal);

revoke all on node_annotations, node_category_assignments, projection_rebuild_generations,
  projection_rebuild_changes from public;

do $migration$
begin
  if exists (select 1 from pg_roles where rolname = 'vision_app') then
    grant select, insert, update, delete on node_annotations to vision_app;
    grant select, insert, update, delete on node_category_assignments to vision_app;
    grant select, insert, update, delete on projection_rebuild_generations to vision_app;
    grant select, insert, update, delete on projection_rebuild_changes to vision_app;
  end if;
end
$migration$;
