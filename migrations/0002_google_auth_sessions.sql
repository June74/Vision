-- Server-owned Google OAuth, protected tokens, and revocable sessions.
create table oauth_transactions (
  state_hash text primary key,
  verifier_envelope bytea not null,
  nonce_envelope bytea not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  check (state_hash <> ''),
  check (expires_at > created_at),
  check (consumed_at is null or consumed_at >= created_at)
);

create table auth_sessions (
  session_id_hash text primary key,
  owner_id text not null,
  google_subject text not null,
  email_envelope bytea not null,
  csrf_token_envelope bytea not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (session_id_hash <> ''),
  check (owner_id <> ''),
  check (google_subject <> ''),
  check (expires_at > created_at),
  check (revoked_at is null or revoked_at >= created_at)
);

create table google_oauth_tokens (
  owner_id text primary key,
  google_subject text not null unique,
  refresh_token_envelope bytea not null,
  access_token_envelope bytea,
  access_expires_at timestamptz not null,
  granted_scopes text not null,
  token_version integer not null,
  updated_at timestamptz not null,
  check (owner_id <> ''),
  check (google_subject <> ''),
  check (granted_scopes <> ''),
  check (token_version > 0)
);

create table wrapped_data_keys (
  owner_id text not null,
  domain text not null,
  key_version integer not null,
  iv text not null,
  wrapped_key text not null,
  primary key (owner_id, domain, key_version),
  check (owner_id <> ''),
  check (domain in ('school', 'work', 'personal', 'unresolved')),
  check (key_version > 0),
  check (iv <> ''),
  check (wrapped_key <> '')
);

create table data_key_state (
  id text primary key,
  active_key_version integer not null,
  check (id = 'primary'),
  check (active_key_version > 0)
);
