/** Closed migration-9 logical schema used to validate backup rows before any restore write. */

/** Exact digest of migrations 0001 through 0009 concatenated in migration order. */
export const BACKUP_SCHEMA_MIGRATION_SHA256 =
  "d77c65c8f4d552b73505b471ac7f672f7651006b2a5190757dcf339e5e6d0e42";

/** Dependency-safe table order used for canonical export and staged restore. */
export const BACKUP_TABLES = [
  "data_key_state",
  "wrapped_data_keys",
  "oauth_admission_windows",
  "oauth_transactions",
  "auth_sessions",
  "google_oauth_tokens",
  "calendar_setup_states",
  "calendar_setup_candidates",
  "vision_calendar_connections",
  "nodes",
  "events",
  "event_sync_payloads",
  "node_annotations",
  "node_category_assignments",
  "edges",
  "audit_events",
  "operation_ledger",
  "calendar_create_snapshots",
  "recoverable_deletions",
  "sync_checkpoints",
  "sync_channels",
  "calendar_sync_maintenance",
  "calendar_sync_jobs",
  "sync_runs",
  "projection_rebuild_generations",
  "projection_rebuild_changes",
  "ai_usage_months",
  "ai_usage_reservations",
  "ai_usage_ledger",
] as const;

/** One table name supported by the current logical backup schema. */
export type BackupTableName = (typeof BACKUP_TABLES)[number];

/** PostgreSQL storage types admitted by the migration-9 backup boundary. */
export type BackupColumnKind =
  | "text"
  | "smallint"
  | "integer"
  | "boolean"
  | "timestamptz"
  | "bytea"
  | "jsonb";

/** One exact column type and nullability declaration. */
export interface BackupColumnContract {
  readonly kind: BackupColumnKind;
  readonly nullable: boolean;
}

/** Declarative row predicate used by a partial unique index. */
export interface BackupIdentityCondition {
  readonly column: string;
  readonly equals?: string;
  readonly oneOf?: readonly string[];
}

/** One non-primary unique identity, including partial-index conditions. */
export interface BackupUniqueIdentity {
  readonly name: string;
  readonly columns: readonly string[];
  readonly where?: readonly BackupIdentityCondition[];
}

/** One current migration foreign-key rule. */
export interface BackupReferenceContract {
  readonly fromColumns: readonly string[];
  readonly toTable: BackupTableName;
  readonly toColumns: readonly string[];
  readonly optional?: boolean;
  readonly onDeleteCascade?: boolean;
}

/** Complete structural contract for one current table. */
export interface BackupTableContract {
  readonly columns: Readonly<Record<string, BackupColumnContract>>;
  readonly primaryKey: readonly string[];
  readonly uniqueIdentities: readonly BackupUniqueIdentity[];
  readonly references: readonly BackupReferenceContract[];
}

type ColumnDeclaration =
  | BackupColumnKind
  | `${BackupColumnKind}?`;

/** Converts concise migration column declarations into frozen contracts. */
function defineColumns(
  declarations: Readonly<Record<string, ColumnDeclaration>>,
): Readonly<Record<string, BackupColumnContract>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(declarations).map(([name, declaration]) => {
        const nullable = declaration.endsWith("?");
        return [
          name,
          Object.freeze({
            kind: (nullable ? declaration.slice(0, -1) : declaration) as BackupColumnKind,
            nullable,
          }),
        ];
      }),
    ),
  );
}

/** Builds one immutable table contract with optional identities and references. */
function defineTable(input: {
  readonly columns: Readonly<Record<string, ColumnDeclaration>>;
  readonly primaryKey: readonly string[];
  readonly uniqueIdentities?: readonly BackupUniqueIdentity[];
  readonly references?: readonly BackupReferenceContract[];
}): BackupTableContract {
  return Object.freeze({
    columns: defineColumns(input.columns),
    primaryKey: Object.freeze([...input.primaryKey]),
    uniqueIdentities: Object.freeze([...(input.uniqueIdentities ?? [])]),
    references: Object.freeze([...(input.references ?? [])]),
  });
}

/** The sole reviewed source for backup columns, keys, identities, and references. */
export const BACKUP_SCHEMA_CONTRACT: Readonly<
  Record<BackupTableName, BackupTableContract>
> = Object.freeze({
  data_key_state: defineTable({
    columns: { id: "text", active_key_version: "integer" },
    primaryKey: ["id"],
  }),
  wrapped_data_keys: defineTable({
    columns: {
      owner_id: "text",
      domain: "text",
      key_version: "integer",
      iv: "text",
      wrapped_key: "text",
    },
    primaryKey: ["owner_id", "domain", "key_version"],
  }),
  oauth_admission_windows: defineTable({
    columns: {
      admission_key_hash: "text",
      window_started_at: "timestamptz",
      request_count: "smallint",
    },
    primaryKey: ["admission_key_hash"],
  }),
  oauth_transactions: defineTable({
    columns: {
      state_hash: "text",
      admission_key_hash: "text",
      admission_slot: "smallint",
      verifier_envelope: "bytea",
      nonce_envelope: "bytea",
      created_at: "timestamptz",
      expires_at: "timestamptz",
      consumed_at: "timestamptz?",
    },
    primaryKey: ["state_hash"],
    uniqueIdentities: [
      {
        name: "oauth_transactions_admission_slot_uq",
        columns: ["admission_key_hash", "admission_slot"],
      },
    ],
  }),
  auth_sessions: defineTable({
    columns: {
      session_id_hash: "text",
      owner_id: "text",
      google_subject: "text",
      email_envelope: "bytea",
      csrf_token_envelope: "bytea",
      created_at: "timestamptz",
      expires_at: "timestamptz",
      revoked_at: "timestamptz?",
    },
    primaryKey: ["session_id_hash"],
  }),
  google_oauth_tokens: defineTable({
    columns: {
      owner_id: "text",
      google_subject: "text",
      refresh_token_envelope: "bytea",
      refresh_token_digest: "text",
      access_token_envelope: "bytea?",
      access_expires_at: "timestamptz",
      granted_scopes: "text",
      token_version: "integer",
      updated_at: "timestamptz",
    },
    primaryKey: ["owner_id"],
    uniqueIdentities: [
      {
        name: "google_oauth_tokens_google_subject_key",
        columns: ["google_subject"],
      },
    ],
  }),
  calendar_setup_states: defineTable({
    columns: {
      owner_id: "text",
      google_subject: "text",
      setup_version: "integer",
      status: "text",
      action_required: "boolean",
      updated_at: "timestamptz",
    },
    primaryKey: ["owner_id"],
  }),
  calendar_setup_candidates: defineTable({
    columns: {
      owner_id: "text",
      provider_calendar_id: "text",
      google_subject: "text",
      summary: "text",
      ownership_access_role: "text",
      time_zone: "text",
      provider_etag: "text",
      verified_at: "timestamptz",
    },
    primaryKey: ["owner_id", "provider_calendar_id"],
    references: [
      {
        fromColumns: ["owner_id"],
        toTable: "calendar_setup_states",
        toColumns: ["owner_id"],
        onDeleteCascade: true,
      },
    ],
  }),
  vision_calendar_connections: defineTable({
    columns: {
      owner_id: "text",
      google_subject: "text",
      provider_calendar_id: "text",
      summary: "text",
      ownership_access_role: "text",
      time_zone: "text",
      provider_etag: "text",
      verified_at: "timestamptz",
      connection_kind: "text",
    },
    primaryKey: ["owner_id"],
    uniqueIdentities: [
      {
        name: "vision_calendar_connections_google_subject_provider_calenda_key",
        columns: ["google_subject", "provider_calendar_id"],
      },
    ],
    references: [
      {
        fromColumns: ["owner_id"],
        toTable: "calendar_setup_states",
        toColumns: ["owner_id"],
      },
    ],
  }),
  nodes: defineTable({
    columns: {
      id: "text",
      owner_id: "text",
      identity_kind: "text",
      provider: "text",
      provider_node_id: "text",
      node_type: "text",
      domain: "text",
      domain_state: "text",
      privacy: "text",
      provenance: "text",
      lifecycle: "text",
      created_at: "timestamptz",
      updated_at: "timestamptz",
      valid_from: "timestamptz",
      valid_to: "timestamptz?",
      version: "integer",
      model_confidence: "integer?",
    },
    primaryKey: ["id"],
    uniqueIdentities: [
      { name: "nodes_id_owner_id_key", columns: ["id", "owner_id"] },
      {
        name: "nodes_id_owner_id_node_type_key",
        columns: ["id", "owner_id", "node_type"],
      },
      {
        name: "nodes_owner_id_provider_provider_node_id_key",
        columns: ["owner_id", "provider", "provider_node_id"],
      },
    ],
  }),
  events: defineTable({
    columns: {
      node_id: "text",
      owner_id: "text",
      node_type: "text",
      provider: "text",
      provider_calendar_id: "text",
      provider_event_id: "text",
      provider_version: "text",
      starts_at: "timestamptz",
      ends_at: "timestamptz",
      time_zone: "text",
      busy: "boolean",
      status: "text",
      recurrence_id: "text?",
      title_envelope: "bytea?",
      description_envelope: "bytea?",
      attendees_envelope: "bytea?",
      location_envelope: "bytea?",
      meeting_link_envelope: "bytea?",
      protected_key_version: "integer?",
    },
    primaryKey: ["node_id"],
    uniqueIdentities: [
      {
        name: "events_node_id_owner_id_key",
        columns: ["node_id", "owner_id"],
      },
      {
        name: "events_provider_provider_calendar_id_provider_event_id_key",
        columns: ["provider", "provider_calendar_id", "provider_event_id"],
      },
    ],
    references: [
      {
        fromColumns: ["node_id", "owner_id"],
        toTable: "nodes",
        toColumns: ["id", "owner_id"],
      },
      {
        fromColumns: ["node_id", "owner_id", "node_type"],
        toTable: "nodes",
        toColumns: ["id", "owner_id", "node_type"],
      },
    ],
  }),
  event_sync_payloads: defineTable({
    columns: {
      node_id: "text",
      owner_id: "text",
      protected_payload_envelope: "bytea",
      protected_key_version: "integer",
    },
    primaryKey: ["node_id"],
    references: [
      {
        fromColumns: ["node_id", "owner_id"],
        toTable: "events",
        toColumns: ["node_id", "owner_id"],
        onDeleteCascade: true,
      },
    ],
  }),
  node_annotations: defineTable({
    columns: {
      id: "text",
      owner_id: "text",
      node_id: "text",
      provenance: "text",
      annotation_envelope: "bytea",
      key_version: "integer",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    primaryKey: ["id"],
    references: [
      {
        fromColumns: ["node_id", "owner_id"],
        toTable: "nodes",
        toColumns: ["id", "owner_id"],
      },
    ],
  }),
  node_category_assignments: defineTable({
    columns: {
      node_id: "text",
      owner_id: "text",
      domain: "text",
      domain_state: "text",
      provenance: "text",
      assigned_at: "timestamptz",
      version: "integer",
    },
    primaryKey: ["node_id"],
    references: [
      {
        fromColumns: ["node_id", "owner_id"],
        toTable: "nodes",
        toColumns: ["id", "owner_id"],
      },
    ],
  }),
  edges: defineTable({
    columns: {
      id: "text",
      owner_id: "text",
      source_node_id: "text",
      source_node_type: "text",
      destination_node_id: "text",
      destination_node_type: "text",
      relation: "text",
      origin: "text",
      evidence: "text?",
      confidence: "integer?",
      lifecycle: "text",
      privacy: "text",
      valid_from: "timestamptz?",
      valid_to: "timestamptz?",
      version: "integer",
    },
    primaryKey: ["id"],
    references: [
      {
        fromColumns: ["source_node_id", "owner_id"],
        toTable: "nodes",
        toColumns: ["id", "owner_id"],
      },
      {
        fromColumns: ["source_node_id", "owner_id", "source_node_type"],
        toTable: "nodes",
        toColumns: ["id", "owner_id", "node_type"],
      },
      {
        fromColumns: ["destination_node_id", "owner_id"],
        toTable: "nodes",
        toColumns: ["id", "owner_id"],
      },
      {
        fromColumns: [
          "destination_node_id",
          "owner_id",
          "destination_node_type",
        ],
        toTable: "nodes",
        toColumns: ["id", "owner_id", "node_type"],
      },
    ],
  }),
  audit_events: defineTable({
    columns: {
      id: "text",
      owner_id: "text",
      node_id: "text?",
      actor_type: "text",
      action: "text",
      outcome: "text",
      provider: "text?",
      error_category: "text?",
      occurred_at: "timestamptz",
    },
    primaryKey: ["id"],
    references: [
      {
        fromColumns: ["node_id", "owner_id"],
        toTable: "nodes",
        toColumns: ["id", "owner_id"],
        optional: true,
      },
    ],
  }),
  operation_ledger: defineTable({
    columns: {
      operation_id: "text",
      owner_id: "text",
      provider: "text",
      provider_operation_id: "text",
      operation_kind: "text",
      status: "text",
      requested_at: "timestamptz",
      completed_at: "timestamptz?",
      response_envelope: "bytea?",
      setup_version: "integer?",
      result_calendar_id: "text?",
    },
    primaryKey: ["operation_id"],
    uniqueIdentities: [
      {
        name: "operation_ledger_one_unresolved_calendar_create_uq",
        columns: ["owner_id", "operation_kind"],
        where: [
          { column: "operation_kind", equals: "vision_calendar_create" },
          {
            column: "status",
            oneOf: ["in_progress", "retryable", "action_required"],
          },
        ],
      },
      {
        name: "operation_ledger_owner_id_provider_provider_operation_id_key",
        columns: ["owner_id", "provider", "provider_operation_id"],
      },
    ],
  }),
  calendar_create_snapshots: defineTable({
    columns: {
      operation_id: "text",
      owner_id: "text",
      provider_calendar_id: "text",
    },
    primaryKey: ["operation_id", "provider_calendar_id"],
    references: [
      {
        fromColumns: ["operation_id"],
        toTable: "operation_ledger",
        toColumns: ["operation_id"],
        onDeleteCascade: true,
      },
    ],
  }),
  recoverable_deletions: defineTable({
    columns: {
      node_id: "text",
      owner_id: "text",
      deleted_at: "timestamptz",
      purge_after: "timestamptz",
      recovery_envelope: "bytea?",
    },
    primaryKey: ["node_id"],
    references: [
      {
        fromColumns: ["node_id", "owner_id"],
        toTable: "nodes",
        toColumns: ["id", "owner_id"],
      },
    ],
  }),
  sync_checkpoints: defineTable({
    columns: {
      id: "text",
      owner_id: "text",
      provider: "text",
      provider_calendar_id: "text",
      sync_token_envelope: "bytea?",
      key_version: "integer?",
      committed_at: "timestamptz",
      version: "integer",
      status: "text",
      last_error_category: "text?",
      updated_at: "timestamptz",
    },
    primaryKey: ["id"],
    uniqueIdentities: [
      {
        name: "sync_checkpoints_owner_id_provider_provider_calendar_id_key",
        columns: ["owner_id", "provider", "provider_calendar_id"],
      },
    ],
  }),
  sync_channels: defineTable({
    columns: {
      id: "text",
      owner_id: "text",
      provider: "text",
      provider_calendar_id: "text",
      provider_channel_id: "text",
      provider_resource_id: "text?",
      verification_token_envelope: "bytea",
      expires_at: "timestamptz",
      verification_token_hash: "text?",
      lifecycle: "text",
      created_at: "timestamptz",
      activated_at: "timestamptz?",
      retired_at: "timestamptz?",
      failure_count: "integer",
      last_failure_at: "timestamptz?",
      renewal_generation: "integer?",
      renewal_lease_id: "text?",
      cleanup_required: "boolean",
    },
    primaryKey: ["id"],
    uniqueIdentities: [
      {
        name: "sync_channels_one_pending_renewal_uq",
        columns: ["owner_id", "provider", "provider_calendar_id"],
        where: [{ column: "lifecycle", equals: "pending" }],
      },
      {
        name: "sync_channels_owner_id_provider_provider_channel_id_key",
        columns: ["owner_id", "provider", "provider_channel_id"],
      },
      {
        name: "sync_channels_provider_channel_lookup_uq",
        columns: ["provider", "provider_channel_id"],
      },
    ],
  }),
  calendar_sync_maintenance: defineTable({
    columns: {
      owner_id: "text",
      provider: "text",
      provider_calendar_id: "text",
      connection_version: "integer",
      checkpoint_version: "integer",
      renewal_generation: "integer",
      renewal_lease_id: "text?",
      renewal_lease_expires_at: "timestamptz?",
      renewal_failures: "integer",
      current_channel_row_id: "text?",
      credential_failure_checkpoint_version: "integer?",
      credential_failure_category: "text?",
      credential_failure_recorded_at: "timestamptz?",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    primaryKey: ["owner_id", "provider", "provider_calendar_id"],
  }),
  calendar_sync_jobs: defineTable({
    columns: {
      job_id: "text",
      owner_id: "text",
      provider: "text",
      provider_calendar_id: "text",
      reason: "text",
      status: "text",
      attempts: "integer",
      claim_id: "text?",
      claimed_at: "timestamptz?",
      completed_at: "timestamptz?",
      last_error_category: "text?",
      action_required: "boolean",
      checkpoint_version: "integer?",
      page_count: "integer?",
      staged_count: "integer?",
      upserted_count: "integer?",
      deleted_count: "integer?",
      unchanged_count: "integer?",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    primaryKey: ["job_id"],
  }),
  sync_runs: defineTable({
    columns: {
      job_id: "text",
      owner_id: "text",
      provider: "text",
      provider_calendar_id: "text",
      reason: "text",
      page_count: "integer",
      staged_count: "integer",
      upserted_count: "integer",
      deleted_count: "integer",
      unchanged_count: "integer",
      started_at: "timestamptz",
      completed_at: "timestamptz",
      checkpoint_version: "integer",
    },
    primaryKey: ["job_id"],
  }),
  projection_rebuild_generations: defineTable({
    columns: {
      id: "text",
      owner_id: "text",
      provider: "text",
      provider_calendar_id: "text",
      job_id: "text",
      queue_claim_id: "text?",
      base_checkpoint_version: "integer",
      status: "text",
      page_count: "integer?",
      created_at: "timestamptz",
      updated_at: "timestamptz",
      activated_at: "timestamptz?",
    },
    primaryKey: ["id"],
    uniqueIdentities: [
      {
        name: "projection_rebuild_generations_job_unique",
        columns: ["owner_id", "provider", "provider_calendar_id", "job_id"],
      },
    ],
  }),
  projection_rebuild_changes: defineTable({
    columns: {
      generation_id: "text",
      identity_hash: "text",
      ordinal: "integer",
      planning_json: "jsonb",
      protected_payload_envelope: "bytea?",
      protected_key_version: "integer?",
    },
    primaryKey: ["generation_id", "identity_hash"],
    uniqueIdentities: [
      {
        name: "projection_rebuild_changes_generation_ordinal_unique",
        columns: ["generation_id", "ordinal"],
      },
    ],
    references: [
      {
        fromColumns: ["generation_id"],
        toTable: "projection_rebuild_generations",
        toColumns: ["id"],
        onDeleteCascade: true,
      },
    ],
  }),
  ai_usage_months: defineTable({
    columns: {
      owner_id: "text",
      budget_month: "text",
      settled_cents: "integer",
      reserved_cents: "integer",
      created_at: "timestamptz",
      updated_at: "timestamptz",
    },
    primaryKey: ["owner_id", "budget_month"],
  }),
  ai_usage_reservations: defineTable({
    columns: {
      id: "text",
      owner_id: "text",
      budget_month: "text",
      idempotency_key: "text",
      request_class: "text",
      status: "text",
      estimated_cents: "integer",
      actual_cents: "integer?",
      provider_request_id: "text?",
      model_id: "text?",
      input_tokens: "integer?",
      output_tokens: "integer?",
      total_tokens: "integer?",
      created_at: "timestamptz",
      expires_at: "timestamptz",
      dispatched_at: "timestamptz?",
      completed_at: "timestamptz?",
    },
    primaryKey: ["id"],
    uniqueIdentities: [
      {
        name: "ai_usage_reservations_one_in_flight_uq",
        columns: ["owner_id"],
        where: [
          { column: "status", oneOf: ["reserved", "dispatched"] },
        ],
      },
      {
        name: "ai_usage_reservations_owner_idempotency_uq",
        columns: ["owner_id", "budget_month", "idempotency_key"],
      },
    ],
  }),
  ai_usage_ledger: defineTable({
    columns: {
      id: "text",
      reservation_id: "text",
      owner_id: "text",
      budget_month: "text",
      event_type: "text",
      estimated_cents: "integer",
      actual_cents: "integer?",
      provider_request_id: "text?",
      model_id: "text?",
      input_tokens: "integer?",
      output_tokens: "integer?",
      total_tokens: "integer?",
      occurred_at: "timestamptz",
    },
    primaryKey: ["id"],
    references: [
      {
        fromColumns: ["reservation_id"],
        toTable: "ai_usage_reservations",
        toColumns: ["id"],
      },
    ],
  }),
});

/** Exact migration-9 columns derived from the sole table contract. */
export const BACKUP_TABLE_COLUMNS: Readonly<
  Record<BackupTableName, readonly string[]>
> = Object.freeze(
  Object.fromEntries(
    BACKUP_TABLES.map((table) => [
      table,
      Object.freeze(Object.keys(BACKUP_SCHEMA_CONTRACT[table].columns)),
    ]),
  ) as Record<BackupTableName, readonly string[]>,
);

/** Validates exact keys, SQL representations, nullability, and all current checks. */
export function validateBackupRow(
  table: BackupTableName,
  row: Readonly<Record<string, unknown>>,
): void {
  requirePlainRow(row);
  const contract = BACKUP_SCHEMA_CONTRACT[table];
  const actual = Reflect.ownKeys(row);
  const expected = Object.keys(contract.columns);
  if (
    actual.some((key) => typeof key !== "string") ||
    actual.length !== expected.length ||
    [...actual].map(String).sort().some((key, index) => key !== [...expected].sort()[index])
  ) {
    throw new Error(`Backup ${table} row fields do not match the supported version.`);
  }
  for (const [column, definition] of Object.entries(contract.columns)) {
    validateColumnValue(table, column, row[column], definition);
  }
  validateTableChecks(table, row);
}

/** Enforces primary and every full or partial unique identity before hashing or staging. */
export function validateBackupTableIdentities(
  table: BackupTableName,
  rows: readonly Readonly<Record<string, unknown>>[],
): void {
  const contract = BACKUP_SCHEMA_CONTRACT[table];
  validateIdentity(
    table,
    `${table}_pkey`,
    contract.primaryKey,
    undefined,
    rows,
    false,
  );
  for (const identity of contract.uniqueIdentities) {
    validateIdentity(
      table,
      identity.name,
      identity.columns,
      identity.where,
      rows,
      true,
    );
  }
}

/** Enforces every migration foreign key against a fully captured snapshot. */
export function validateBackupReferences(
  tables: Readonly<
    Record<BackupTableName, readonly Readonly<Record<string, unknown>>[]>
  >,
): void {
  for (const fromTable of BACKUP_TABLES) {
    for (const reference of BACKUP_SCHEMA_CONTRACT[fromTable].references) {
      const targetKeys = new Set(
        tables[reference.toTable].map((row) =>
          referenceKey(row, reference.toColumns, false),
        ),
      );
      for (const row of tables[fromTable]) {
        const key = referenceKey(
          row,
          reference.fromColumns,
          reference.optional ?? false,
        );
        if (key !== undefined && !targetKeys.has(key)) {
          throw new Error(
            `Backup reference from ${fromTable} to ${reference.toTable} is invalid.`,
          );
        }
      }
    }
  }
}

/** Validates one value against its PostgreSQL type and nullability contract. */
function validateColumnValue(
  table: BackupTableName,
  column: string,
  value: unknown,
  definition: BackupColumnContract,
): void {
  if (value === null) {
    if (definition.nullable) return;
    throw new Error(`Backup ${table}.${column} violates NOT NULL.`);
  }
  let valid = false;
  switch (definition.kind) {
    case "text":
      valid = typeof value === "string";
      break;
    case "smallint":
      valid = isDatabaseInteger(value, -32_768, 32_767);
      break;
    case "integer":
      valid = isDatabaseInteger(value, -2_147_483_648, 2_147_483_647);
      break;
    case "boolean":
      valid = typeof value === "boolean";
      break;
    case "timestamptz":
      valid = isDatabaseTimestamp(value);
      break;
    case "bytea":
      valid =
        value instanceof Uint8Array ||
        (typeof value === "string" &&
          /^\\x(?:[0-9A-Fa-f]{2})*$/.test(value));
      break;
    case "jsonb":
      valid = isJsonValue(value, 0);
      break;
  }
  if (!valid) {
    throw new Error(
      `Backup ${table}.${column} is not a valid ${definition.kind} value.`,
    );
  }
}

/** Mirrors all migration check constraints for one already typed backup row. */
function validateTableChecks(
  table: BackupTableName,
  row: Readonly<Record<string, unknown>>,
): void {
  /** Checks that every named text column is non-empty. */
  const nonempty = (...columns: string[]) =>
    columns.every((column) => text(row, column).length > 0);
  /** Checks that a text column is one of a closed set. */
  const oneOf = (column: string, values: readonly string[]) =>
    values.includes(text(row, column));
  /** Checks a nullable text column against a closed set when present. */
  const optionalOneOf = (column: string, values: readonly string[]) =>
    row[column] === null || oneOf(column, values);
  /** Checks that an integer column is strictly positive. */
  const positive = (column: string) => integer(row, column) > 0;
  /** Checks that an integer column is zero or positive. */
  const nonnegative = (column: string) => integer(row, column) >= 0;
  /** Checks that a nullable integer column is positive when present. */
  const optionalPositive = (column: string) =>
    row[column] === null || positive(column);
  /** Checks that a nullable integer column is nonnegative when present. */
  const optionalNonnegative = (column: string) =>
    row[column] === null || nonnegative(column);
  /** Checks that one timestamp is not earlier than another. */
  const atLeast = (left: string, right: string) =>
    timestamp(row, left) >= timestamp(row, right);
  /** Checks that one timestamp is strictly later than another. */
  const after = (left: string, right: string) =>
    timestamp(row, left) > timestamp(row, right);
  /** Checks timestamp ordering only when the left value is present. */
  const optionalAtLeast = (left: string, right: string) =>
    row[left] === null || atLeast(left, right);
  /** Converts a failed mirrored migration predicate into a closed error. */
  const requireCheck = (condition: boolean) => {
    if (!condition) {
      throw new Error(`Backup ${table} row violates a migration check.`);
    }
  };
  const errorCategories = [
    "authorization",
    "concurrency",
    "database",
    "provider",
    "payload_too_large",
    "quota",
    "schema",
    "sync_token_invalid",
    "transient",
  ] as const;
  const syncReasons = ["initial", "manual", "push", "rebuild", "repair"] as const;
  /** Checks the canonical YYYY-MM form used by AI budget rows. */
  const budgetMonth = (column: string) =>
    /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(text(row, column));

  switch (table) {
    case "data_key_state":
      requireCheck(row.id === "primary" && positive("active_key_version"));
      break;
    case "wrapped_data_keys":
      requireCheck(
        nonempty("owner_id", "iv", "wrapped_key") &&
          oneOf("domain", ["school", "work", "personal", "unresolved"]) &&
          positive("key_version"),
      );
      break;
    case "oauth_admission_windows":
      requireCheck(
        nonempty("admission_key_hash") &&
          integer(row, "request_count") >= 1 &&
          integer(row, "request_count") <= 5,
      );
      break;
    case "oauth_transactions":
      requireCheck(
        nonempty("state_hash", "admission_key_hash") &&
          integer(row, "admission_slot") >= 1 &&
          integer(row, "admission_slot") <= 3 &&
          after("expires_at", "created_at") &&
          optionalAtLeast("consumed_at", "created_at"),
      );
      break;
    case "auth_sessions":
      requireCheck(
        nonempty("session_id_hash", "owner_id", "google_subject") &&
          after("expires_at", "created_at") &&
          optionalAtLeast("revoked_at", "created_at"),
      );
      break;
    case "google_oauth_tokens":
      requireCheck(
        nonempty("owner_id", "google_subject", "granted_scopes") &&
          /^[A-Za-z0-9_-]{43}$/.test(text(row, "refresh_token_digest")) &&
          positive("token_version"),
      );
      break;
    case "calendar_setup_states":
      requireCheck(
        nonempty("owner_id", "google_subject") &&
          positive("setup_version") &&
          oneOf("status", [
            "authenticated",
            "discovering",
            "awaiting_choice",
            "awaiting_confirmation",
            "creating",
            "connected",
            "failed",
          ]) &&
          (!row.action_required || row.status === "failed"),
      );
      break;
    case "calendar_setup_candidates":
      requireCheck(
        nonempty(
          "provider_calendar_id",
          "google_subject",
          "time_zone",
          "provider_etag",
        ) &&
          row.summary === "Vision" &&
          row.ownership_access_role === "owner",
      );
      break;
    case "vision_calendar_connections":
      requireCheck(
        nonempty(
          "provider_calendar_id",
          "google_subject",
          "time_zone",
          "provider_etag",
        ) &&
          row.summary === "Vision" &&
          row.ownership_access_role === "owner" &&
          oneOf("connection_kind", ["existing", "created"]),
      );
      break;
    case "nodes": {
      const inferred = row.domain_state === "inferred";
      const confidence = row.model_confidence;
      requireCheck(
        nonempty("owner_id", "provider", "provider_node_id") &&
          oneOf("identity_kind", ["provider", "first_party", "system"]) &&
          oneOf("node_type", [
            "event",
            "task",
            "note",
            "commitment",
            "recommendation",
            "preference",
            "policy",
            "audit_event",
            "person",
            "calendar",
            "source_artifact",
            "alert_episode",
          ]) &&
          oneOf("domain", ["school", "work", "personal", "unresolved"]) &&
          oneOf("domain_state", ["confirmed", "inferred", "unresolved"]) &&
          (row.domain === "unresolved") ===
            (row.domain_state === "unresolved") &&
          oneOf("privacy", ["planning", "private", "restricted"]) &&
          oneOf("provenance", ["provider", "user", "system", "model"]) &&
          oneOf("lifecycle", ["active", "deleted", "purged"]) &&
          atLeast("updated_at", "created_at") &&
          (row.valid_to === null || after("valid_to", "valid_from")) &&
          positive("version") &&
          inferred === (confidence !== null) &&
          (confidence === null ||
            (integer(row, "model_confidence") >= 0 &&
              integer(row, "model_confidence") <= 1_000_000)),
      );
      break;
    }
    case "events":
      requireCheck(
        nonempty(
          "provider",
          "provider_calendar_id",
          "provider_event_id",
          "provider_version",
        ) &&
          row.node_type === "event" &&
          after("ends_at", "starts_at") &&
          oneOf("status", ["confirmed", "tentative", "cancelled"]) &&
          optionalPositive("protected_key_version"),
      );
      break;
    case "event_sync_payloads":
      requireCheck(positive("protected_key_version"));
      break;
    case "node_annotations":
      requireCheck(
        nonempty("owner_id") &&
          oneOf("provenance", ["user", "system", "model"]) &&
          positive("key_version") &&
          atLeast("updated_at", "created_at"),
      );
      break;
    case "node_category_assignments":
      requireCheck(
        oneOf("domain", ["school", "work", "personal"]) &&
          oneOf("domain_state", ["confirmed", "inferred"]) &&
          oneOf("provenance", ["user", "system", "model"]) &&
          positive("version"),
      );
      break;
    case "edges": {
      const relationTypes: Readonly<Record<string, readonly [string, string]>> = {
        event_in_calendar: ["event", "calendar"],
        task_from_source: ["task", "source_artifact"],
        note_about_event: ["note", "event"],
        commitment_for_person: ["commitment", "person"],
        recommendation_for_event: ["recommendation", "event"],
        preference_for_policy: ["preference", "policy"],
        policy_governs_event: ["policy", "event"],
        alert_episode_for_event: ["alert_episode", "event"],
      };
      const types = relationTypes[text(row, "relation")];
      requireCheck(
        types !== undefined &&
          row.source_node_type === types[0] &&
          row.destination_node_type === types[1] &&
          oneOf("origin", ["provider", "user", "system", "model"]) &&
          oneOf("lifecycle", ["proposed", "confirmed", "rejected", "retracted"]) &&
          oneOf("privacy", ["planning", "private", "restricted"]) &&
          (row.confidence === null ||
            (integer(row, "confidence") >= 0 &&
              integer(row, "confidence") <= 1_000_000)) &&
          (row.valid_to === null ||
            (row.valid_from !== null && after("valid_to", "valid_from"))) &&
          positive("version"),
      );
      break;
    }
    case "audit_events":
      requireCheck(nonempty("owner_id"));
      break;
    case "operation_ledger":
      requireCheck(
        nonempty("provider", "provider_operation_id") &&
          optionalPositive("setup_version") &&
          (row.result_calendar_id === null ||
            text(row, "result_calendar_id").length > 0) &&
          (row.operation_kind !== "vision_calendar_create" ||
            (row.setup_version !== null &&
              oneOf("status", [
                "in_progress",
                "retryable",
                "completed",
                "action_required",
                "definite_failure",
              ]))),
      );
      break;
    case "calendar_create_snapshots":
      requireCheck(nonempty("owner_id", "provider_calendar_id"));
      break;
    case "recoverable_deletions":
      requireCheck(after("purge_after", "deleted_at"));
      break;
    case "sync_checkpoints": {
      const emptyCheckpoint = integer(row, "version") === 0;
      requireCheck(
        nonempty("provider", "provider_calendar_id") &&
          nonnegative("version") &&
          optionalPositive("key_version") &&
          oneOf("status", [
            "pending",
            "connected",
            "disconnected",
            "action_required",
            "rebuild_required",
            "retry_scheduled",
          ]) &&
          optionalOneOf("last_error_category", errorCategories) &&
          (emptyCheckpoint
            ? row.sync_token_envelope === null && row.key_version === null
            : row.sync_token_envelope !== null &&
              row.key_version !== null &&
              positive("key_version")),
      );
      break;
    }
    case "sync_channels": {
      const lifecycle = text(row, "lifecycle");
      const pendingOrFailed =
        lifecycle === "pending" || lifecycle === "failed";
      const activeOrRetired =
        lifecycle === "active" || lifecycle === "retired";
      requireCheck(
        nonempty("provider", "provider_calendar_id", "provider_channel_id") &&
          (row.provider_resource_id === null ||
            text(row, "provider_resource_id").length > 0) &&
          optionalHash(row.verification_token_hash) &&
          oneOf("lifecycle", ["pending", "active", "retired", "failed"]) &&
          ((activeOrRetired && row.provider_resource_id !== null) ||
            pendingOrFailed) &&
          ((lifecycle === "active" &&
            row.activated_at !== null &&
            row.retired_at === null) ||
            (lifecycle === "retired" &&
              row.activated_at !== null &&
              row.retired_at !== null) ||
            pendingOrFailed) &&
          nonnegative("failure_count") &&
          optionalPositive("renewal_generation") &&
          ((pendingOrFailed === (row.renewal_lease_id !== null)) ||
            activeOrRetired),
      );
      break;
    }
    case "calendar_sync_maintenance": {
      const credentialVersion = row.credential_failure_checkpoint_version;
      const credentialCategory = row.credential_failure_category;
      const credentialAt = row.credential_failure_recorded_at;
      requireCheck(
        nonempty("owner_id", "provider", "provider_calendar_id") &&
          positive("connection_version") &&
          nonnegative("checkpoint_version") &&
          nonnegative("renewal_generation") &&
          nonnegative("renewal_failures") &&
          optionalNonnegative("credential_failure_checkpoint_version") &&
          optionalOneOf("credential_failure_category", errorCategories) &&
          (credentialVersion === null) === (credentialCategory === null) &&
          (credentialVersion === null) === (credentialAt === null) &&
          (row.renewal_lease_id === null) ===
            (row.renewal_lease_expires_at === null) &&
          atLeast("updated_at", "created_at"),
      );
      break;
    }
    case "calendar_sync_jobs": {
      const inProgress = row.status === "in_progress";
      const terminal = row.status === "succeeded" || row.status === "failed";
      requireCheck(
        nonempty("owner_id", "provider", "provider_calendar_id") &&
          oneOf("reason", syncReasons) &&
          oneOf("status", [
            "pending_enqueue",
            "enqueued",
            "in_progress",
            "retry_scheduled",
            "succeeded",
            "failed",
          ]) &&
          nonnegative("attempts") &&
          (inProgress
            ? row.claim_id !== null && row.claimed_at !== null
            : row.claim_id === null) &&
          optionalOneOf("last_error_category", errorCategories) &&
          optionalPositive("checkpoint_version") &&
          (row.page_count === null || positive("page_count")) &&
          optionalNonnegative("staged_count") &&
          optionalNonnegative("upserted_count") &&
          optionalNonnegative("deleted_count") &&
          optionalNonnegative("unchanged_count") &&
          terminal === (row.completed_at !== null) &&
          (!row.action_required || row.status === "failed") &&
          atLeast("updated_at", "created_at") &&
          optionalAtLeast("claimed_at", "created_at") &&
          optionalAtLeast("completed_at", "created_at"),
      );
      break;
    }
    case "sync_runs":
      requireCheck(
        nonempty("owner_id", "provider", "provider_calendar_id") &&
          oneOf("reason", syncReasons) &&
          positive("page_count") &&
          nonnegative("staged_count") &&
          nonnegative("upserted_count") &&
          nonnegative("deleted_count") &&
          nonnegative("unchanged_count") &&
          atLeast("completed_at", "started_at") &&
          positive("checkpoint_version"),
      );
      break;
    case "projection_rebuild_generations":
      requireCheck(
        nonempty("owner_id", "provider_calendar_id", "job_id") &&
          row.provider === "google-calendar" &&
          (row.queue_claim_id === null ||
            text(row, "queue_claim_id").length > 0) &&
          positive("base_checkpoint_version") &&
          oneOf("status", ["staging", "ready", "activated", "abandoned"]) &&
          (row.page_count === null || positive("page_count")) &&
          (row.status === "activated") === (row.activated_at !== null) &&
          atLeast("updated_at", "created_at") &&
          optionalAtLeast("activated_at", "created_at"),
      );
      break;
    case "projection_rebuild_changes":
      requireCheck(
        /^[A-Za-z0-9_-]{43}$/.test(text(row, "identity_hash")) &&
          nonnegative("ordinal") &&
          ((row.protected_payload_envelope === null &&
            row.protected_key_version === null) ||
            (row.protected_payload_envelope !== null &&
              row.protected_key_version !== null &&
              positive("protected_key_version"))),
      );
      break;
    case "ai_usage_months":
      requireCheck(
        nonempty("owner_id") &&
          budgetMonth("budget_month") &&
          nonnegative("settled_cents") &&
          nonnegative("reserved_cents") &&
          atLeast("updated_at", "created_at"),
      );
      break;
    case "ai_usage_reservations": {
      const status = text(row, "status");
      const dispatched = ["dispatched", "settled", "settled_estimate"].includes(
        status,
      );
      const completed = ["settled", "settled_estimate", "released"].includes(
        status,
      );
      const settled = ["settled", "settled_estimate"].includes(status);
      requireCheck(
        nonempty("owner_id", "idempotency_key") &&
          budgetMonth("budget_month") &&
          oneOf("request_class", ["routine", "optional", "complex"]) &&
          oneOf("status", [
            "reserved",
            "dispatched",
            "settled",
            "settled_estimate",
            "released",
          ]) &&
          positive("estimated_cents") &&
          optionalNonnegative("actual_cents") &&
          optionalNonnegative("input_tokens") &&
          optionalNonnegative("output_tokens") &&
          optionalNonnegative("total_tokens") &&
          after("expires_at", "created_at") &&
          dispatched === (row.dispatched_at !== null) &&
          completed === (row.completed_at !== null) &&
          settled === (row.actual_cents !== null) &&
          optionalAtLeast("dispatched_at", "created_at") &&
          optionalAtLeast("completed_at", "created_at"),
      );
      break;
    }
    case "ai_usage_ledger":
      requireCheck(
        nonempty("owner_id") &&
          budgetMonth("budget_month") &&
          oneOf("event_type", [
            "reserved",
            "dispatched",
            "settled",
            "settled_estimate",
            "released",
          ]) &&
          positive("estimated_cents") &&
          optionalNonnegative("actual_cents") &&
          optionalNonnegative("input_tokens") &&
          optionalNonnegative("output_tokens") &&
          optionalNonnegative("total_tokens"),
      );
      break;
  }
}

/** Rejects duplicate primary or alternate identities within one table. */
function validateIdentity(
  table: BackupTableName,
  name: string,
  columns: readonly string[],
  where: readonly BackupIdentityCondition[] | undefined,
  rows: readonly Readonly<Record<string, unknown>>[],
  nullable: boolean,
): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!matchesIdentityConditions(row, where)) continue;
    const values = columns.map((column) => row[column]);
    if (nullable && values.some((value) => value === null)) continue;
    if (values.some((value) => value === undefined)) {
      throw new Error(`Backup ${table} identity ${name} is incomplete.`);
    }
    const key = JSON.stringify(
      values.map((value) => [
        typeof value,
        typeof value === "bigint" ? value.toString() : value,
      ]),
    );
    if (seen.has(key)) {
      throw new Error(`Backup ${table} identity ${name} is duplicated.`);
    }
    seen.add(key);
  }
}

/** Evaluates the predicate attached to a partial unique identity. */
function matchesIdentityConditions(
  row: Readonly<Record<string, unknown>>,
  where: readonly BackupIdentityCondition[] | undefined,
): boolean {
  return (where ?? []).every((condition) => {
    const value = row[condition.column];
    return condition.equals !== undefined
      ? value === condition.equals
      : condition.oneOf?.includes(value as string) === true;
  });
}

/** Encodes a typed composite foreign-key value for exact set membership. */
function referenceKey(
  row: Readonly<Record<string, unknown>>,
  columns: readonly string[],
  optional: boolean,
): string | undefined {
  const values = columns.map((column) => row[column]);
  if (optional && values[0] === null) return undefined;
  if (values.some((value) => value === null || value === undefined)) {
    throw new Error("Backup reference contains an unexpected null.");
  }
  return JSON.stringify(
    values.map((value) => [
      typeof value,
      typeof value === "bigint" ? value.toString() : value,
    ]),
  );
}

/** Rejects rows with prototypes, symbols, accessors, or hidden properties. */
function requirePlainRow(row: Readonly<Record<string, unknown>>): void {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    throw new Error("Backup row must be a plain object.");
  }
  const prototype = Object.getPrototypeOf(row);
  const descriptors = Object.getOwnPropertyDescriptors(row);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Reflect.ownKeys(row).some(
      (key) =>
        typeof key !== "string" ||
        !descriptors[key]?.enumerable ||
        !("value" in descriptors[key]!),
    )
  ) {
    throw new Error("Backup row must contain plain enumerable values.");
  }
}

/** Admits canonical PostgreSQL integer representations within a SQL range. */
function isDatabaseInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): boolean {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^-?(0|[1-9]\d*)$/.test(value)
        ? Number(value)
        : Number.NaN;
  return (
    Number.isSafeInteger(parsed) &&
    parsed >= minimum &&
    parsed <= maximum
  );
}

/** Admits valid Date objects and PostgreSQL timestamps with explicit offsets. */
function isDatabaseTimestamp(value: unknown): boolean {
  if (value instanceof Date) {
    return Number.isFinite(Date.prototype.getTime.call(value));
  }
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(
      value,
    )
  ) {
    return false;
  }
  return Number.isFinite(Date.parse(value));
}

/** Recursively admits only values representable by PostgreSQL JSONB. */
function isJsonValue(value: unknown, depth: number): boolean {
  if (depth > 64) return false;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) {
    return value.every((entry) => isJsonValue(entry, depth + 1));
  }
  if (
    typeof value !== "object" ||
    value instanceof Date ||
    value instanceof Uint8Array
  ) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Reflect.ownKeys(value).every(
    (key) =>
      typeof key === "string" &&
      descriptors[key]?.enumerable === true &&
      "value" in descriptors[key]! &&
      isJsonValue(descriptors[key]!.value, depth + 1),
  );
}

/** Reads one already validated PostgreSQL integer representation. */
function integer(
  row: Readonly<Record<string, unknown>>,
  column: string,
): number {
  const value = row[column];
  return typeof value === "number" ? value : Number(value);
}

/** Reads one already validated text column. */
function text(
  row: Readonly<Record<string, unknown>>,
  column: string,
): string {
  return row[column] as string;
}

/** Converts one already validated timestamp column to epoch milliseconds. */
function timestamp(
  row: Readonly<Record<string, unknown>>,
  column: string,
): number {
  const value = row[column];
  return value instanceof Date ? value.getTime() : Date.parse(value as string);
}

/** Checks an optional canonical unpadded SHA-256 base64url digest. */
function optionalHash(value: unknown): boolean {
  return value === null || (typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value));
}
