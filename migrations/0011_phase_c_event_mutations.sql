-- Phase C one-off mutation identity and scope, additive to the create surface.
alter table calendar_write_approvals
  add column action text not null default 'create',
  add column provider_event_id text,
  add column provider_event_version text,
  add column mutation_scope text not null default 'single',
  add constraint calendar_write_approvals_action_valid
    check (action in ('create', 'update', 'move', 'cancel', 'delete')),
  add constraint calendar_write_approvals_event_identity_paired
    check ((provider_event_id is null) = (provider_event_version is null)),
  add constraint calendar_write_approvals_action_identity
    check (
      (action = 'create' and provider_event_id is null and provider_event_version is null)
      or
      (action <> 'create' and provider_event_id is not null and provider_event_version is not null)
    ),
  add constraint calendar_write_approvals_scope_valid
    check (mutation_scope in ('single', 'series'));
