/** Supplies consistent Neon reads and transaction-locked PostgreSQL restore promotion. */
import { neon, Pool, types } from "@neondatabase/serverless";
import { encodeBase64Url } from "../../crypto/envelope";
import {
  BACKUP_SCHEMA_MIGRATION_SHA256,
  BACKUP_SCHEMA_CONTRACT,
  BACKUP_TABLE_COLUMNS,
  validateBackupReferences,
} from "../../domain/backup/schema-contract";
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  type BackupRow,
  type BackupRowCounts,
  type BackupSnapshotV1,
  type BackupTableName,
  type BackupValue,
} from "../../domain/backup/manifest";
import { parseVisionDatabaseUrl } from "../../server/env";
import type {
  BackupRestoreStage,
  BackupRestoreTarget,
  BackupRestoreTransaction,
  RestoreTargetDescription,
} from "./import-backup";
import type { BackupSnapshotSource } from "../../jobs/create-daily-backup";

/** One closed projection query paired with its authoritative destination table. */
export interface BackupSnapshotQuery {
  readonly table: BackupTableName;
  readonly sql: string;
}

/** Batch boundary required to execute every projection in one read transaction. */
export interface BackupReadTransactionPort {
  readOnlyRepeatableRead(
    queries: readonly BackupSnapshotQuery[],
  ): Promise<readonly (readonly BackupRow[])[]>;
}

/** Minimal interactive PostgreSQL client used by the restore transaction adapter. */
export interface PostgresClientPort {
  query<Row extends Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<{ readonly rows: readonly Row[] }>;
  release(): void;
}

/** Connection-pool boundary used to keep one restore on one transaction session. */
export interface PostgresClientPoolPort {
  connect(): Promise<PostgresClientPort>;
}

/** Operator expectation that must match the independent database-owned attestation. */
export interface BackupRestoreTargetIdentity {
  readonly environment: "preview";
  readonly targetId: string;
  readonly disposable: true;
}

/** Target plus a close operation for the operator process. */
export interface ManagedBackupRestoreTarget {
  readonly target: BackupRestoreTarget;
  close(): Promise<void>;
}

interface StagedSnapshot {
  readonly stage: BackupRestoreStage;
  readonly snapshot: BackupSnapshotV1;
  readonly tables: Readonly<Record<BackupTableName, string>>;
}

interface RestoreTargetAttestationRow extends Record<string, unknown> {
  readonly environment: unknown;
  readonly target_id: unknown;
  readonly disposable: unknown;
  readonly schema_version: unknown;
  readonly migration_sha256: unknown;
  readonly attestation_revision: unknown;
}

interface ValidatedRestoreTargetAttestation {
  readonly environment: "preview";
  readonly targetId: string;
  readonly disposable: true;
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  readonly revision: string;
}

/** Creates a source that submits exactly one complete migration-9 projection batch. */
export function createBackupSnapshotSource(
  transaction: BackupReadTransactionPort,
): BackupSnapshotSource {
  return {
    /** Owns all table results returned by the one repeatable-read transaction. */
    async readConsistentSnapshot(): Promise<BackupSnapshotV1> {
      const queries = backupSnapshotQueries();
      const results = await transaction.readOnlyRepeatableRead(queries);
      if (results.length !== BACKUP_TABLES.length) {
        throw new Error("Backup snapshot transaction returned incomplete results.");
      }
      const tables = Object.fromEntries(
        BACKUP_TABLES.map((table, index) => [
          table,
          Array.from(results[index] ?? [], (row) => ({ ...row })),
        ]),
      ) as Record<BackupTableName, BackupRow[]>;
      return { schemaVersion: BACKUP_SCHEMA_VERSION, tables };
    },
  };
}

/** Creates the production Neon HTTP source using one read-only RepeatableRead batch. */
export function createNeonBackupSnapshotSource(
  databaseUrl: unknown,
): BackupSnapshotSource {
  types.setTypeParser(types.builtins.BYTEA, "text", (value) => value);
  types.setTypeParser(types.builtins.TIMESTAMPTZ, "text", (value) => value);
  const sql = neon(parseVisionDatabaseUrl(databaseUrl));
  return createBackupSnapshotSource({
    /** Submits every table projection in one read-only repeatable-read HTTP transaction. */
    async readOnlyRepeatableRead(queries) {
      const results = await sql.transaction(
        queries.map((query) => sql.query(query.sql)),
        { isolationLevel: "RepeatableRead", readOnly: true },
      );
      return results as readonly (readonly BackupRow[])[];
    },
  });
}

/** Creates the interactive production Neon target used only by the operator restore process. */
export function createNeonBackupRestoreTarget(
  databaseUrl: unknown,
  identity: BackupRestoreTargetIdentity,
): ManagedBackupRestoreTarget {
  const pool = new Pool({
    connectionString: parseVisionDatabaseUrl(databaseUrl),
  });
  const target = createPostgresBackupRestoreTarget(
    {
      /** Opens one session retained for the complete interactive restore transaction. */
      async connect(): Promise<PostgresClientPort> {
        const client = await pool.connect();
        return {
          /** Executes one parameterized statement on the retained restore session. */
          async query<Row extends Record<string, unknown>>(
            statement: string,
            parameters: readonly unknown[] = [],
          ) {
            const result = await client.query(statement, [...parameters]);
            return { rows: result.rows as readonly Row[] };
          },
          /** Returns the retained session to the pool after commit or rollback. */
          release() {
            client.release();
          },
        };
      },
    },
    identity,
  );
  return {
    target,
    /** Closes all remaining operator-process connections. */
    async close() {
      await pool.end();
    },
  };
}

/** Creates one lock/stage/inspect/promote target over an interactive PostgreSQL pool. */
export function createPostgresBackupRestoreTarget(
  pool: PostgresClientPoolPort,
  identity: BackupRestoreTargetIdentity,
): BackupRestoreTarget {
  validateTargetIdentity(identity);
  return {
    /** Runs one callback inside a serializable transaction on a single connection. */
    async transaction<T>(
      operation: (transaction: BackupRestoreTransaction) => Promise<T>,
    ): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("begin isolation level serializable");
        const transaction = new PostgresBackupRestoreTransaction(
          client,
          identity,
        );
        const result = await operation(transaction);
        await client.query("commit");
        return result;
      } catch (error) {
        try {
          await client.query("rollback");
        } catch {
          // Preserve the original restore failure; a closed connection also rolls back.
        }
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

/** Owns the transaction-scoped restore state after all public tables are locked. */
class PostgresBackupRestoreTransaction
  implements BackupRestoreTransaction
{
  private description: RestoreTargetDescription | undefined;
  private staged: StagedSnapshot | undefined;

  constructor(
    private readonly client: PostgresClientPort,
    private readonly identity: BackupRestoreTargetIdentity,
  ) {}

  /** Attests the connected preview database, then locks all authoritative tables and counts. */
  async lockTargetForRestore(): Promise<RestoreTargetDescription> {
    if (this.description) throw new Error("Backup restore target is already locked.");
    const attestation = await readRestoreTargetAttestation(
      this.client,
      this.identity,
    );
    await this.client.query(
      `lock table ${BACKUP_TABLES.map(publicTable).join(", ")}
       in access exclusive mode`,
    );
    const rowCounts = await readRowCounts(this.client, publicTable);
    this.description = Object.freeze({
      ...attestation,
      rowCounts,
    });
    return this.description;
  }

  /** Copies validated raw rows into constraint-bearing transaction-local tables. */
  async stage(snapshot: BackupSnapshotV1): Promise<BackupRestoreStage> {
    this.requireLocked();
    if (this.staged) throw new Error("Backup restore stage already exists.");
    const stage: BackupRestoreStage = {
      opaqueId: `stage_${randomOpaque(18)}`,
    };
    const token = randomSqlToken(9);
    const tables = Object.fromEntries(
      BACKUP_TABLES.map((table, index) => [
        table,
        `vision_backup_${token}_${String(index).padStart(2, "0")}`,
      ]),
    ) as Record<BackupTableName, string>;

    for (const table of BACKUP_TABLES) {
      const staging = quotedIdentifier(tables[table]);
      await this.client.query(
        `create temp table ${staging}
         (like ${publicTable(table)} including all) on commit drop`,
      );
      for (const row of snapshot.tables[table]) {
        const columns = BACKUP_TABLE_COLUMNS[table];
        await this.client.query(
          `insert into ${staging}
           (${columns.map(quotedIdentifier).join(", ")})
           values (${columns.map((_, index) => `$${index + 1}`).join(", ")})`,
          columns.map((column) =>
            postgresParameter(
              row[column]!,
              BACKUP_SCHEMA_CONTRACT[table].columns[column]!.kind,
            ),
          ),
        );
      }
    }
    this.staged = { stage, snapshot, tables };
    return stage;
  }

  /** Recounts staged rows after PostgreSQL type/check/identity admission. */
  async inspectStage(
    stage: BackupRestoreStage,
  ): Promise<{ readonly rowCounts: BackupRowCounts; readonly referencesValid: boolean }> {
    const staged = this.requireStage(stage);
    let referencesValid = false;
    try {
      validateBackupReferences(staged.snapshot.tables);
      referencesValid = true;
    } catch {
      // The caller receives one closed boolean and never the staged reference values.
    }
    return {
      rowCounts: await readRowCounts(
        this.client,
        (table) => quotedIdentifier(staged.tables[table]),
      ),
      referencesValid,
    };
  }

  /** Recounts the locked target and requires every captured target fact to remain identical. */
  async assertTargetUnchanged(
    expected: RestoreTargetDescription,
  ): Promise<void> {
    const locked = this.requireLocked();
    if (
      expected.targetId !== locked.targetId ||
      expected.environment !== locked.environment ||
      expected.disposable !== locked.disposable ||
      expected.schemaVersion !== locked.schemaVersion ||
      expected.revision !== locked.revision
    ) {
      throw new Error("Backup restore target identity changed.");
    }
    const currentAttestation = await readRestoreTargetAttestation(
      this.client,
      this.identity,
    );
    if (
      currentAttestation.targetId !== locked.targetId ||
      currentAttestation.environment !== locked.environment ||
      currentAttestation.disposable !== locked.disposable ||
      currentAttestation.schemaVersion !== locked.schemaVersion ||
      currentAttestation.revision !== locked.revision
    ) {
      throw new Error("Backup restore target attestation changed.");
    }
    const currentCounts = await readRowCounts(this.client, publicTable);
    if (
      BACKUP_TABLES.some(
        (table) => currentCounts[table] !== locked.rowCounts[table],
      )
    ) {
      throw new Error("Backup restore target changed while locked.");
    }
  }

  /** Deletes in reverse dependency order and inserts staged rows atomically. */
  async promote(
    stage: BackupRestoreStage,
    options: {
      readonly replaceExisting: boolean;
      readonly expectedTarget: RestoreTargetDescription;
    },
  ): Promise<void> {
    const staged = this.requireStage(stage);
    await this.assertTargetUnchanged(options.expectedTarget);
    const targetWasEmpty = BACKUP_TABLES.every(
      (table) => options.expectedTarget.rowCounts[table] === 0,
    );
    if (options.replaceExisting === targetWasEmpty) {
      throw new Error("Backup restore replacement policy changed.");
    }
    if (options.replaceExisting) {
      for (const table of [...BACKUP_TABLES].reverse()) {
        await this.client.query(`delete from ${publicTable(table)}`);
      }
    }
    for (const table of BACKUP_TABLES) {
      const columns = BACKUP_TABLE_COLUMNS[table]
        .map(quotedIdentifier)
        .join(", ");
      await this.client.query(
        `insert into ${publicTable(table)} (${columns})
         select ${columns} from ${quotedIdentifier(staged.tables[table])}`,
      );
    }
  }

  /** Requires the target lock to precede every stage or policy operation. */
  private requireLocked(): RestoreTargetDescription {
    if (!this.description) throw new Error("Backup restore target is not locked.");
    return this.description;
  }

  /** Requires the exact transaction-owned stage identity. */
  private requireStage(stage: BackupRestoreStage): StagedSnapshot {
    this.requireLocked();
    if (!this.staged || stage.opaqueId !== this.staged.stage.opaqueId) {
      throw new Error("Backup restore stage is invalid.");
    }
    return this.staged;
  }
}

/** Reads and validates the independently provisioned disposable-preview database attestation. */
async function readRestoreTargetAttestation(
  client: PostgresClientPort,
  expected: BackupRestoreTargetIdentity,
): Promise<ValidatedRestoreTargetAttestation> {
  let result: {
    readonly rows: readonly RestoreTargetAttestationRow[];
  };
  try {
    result = await client.query<RestoreTargetAttestationRow>(
      `select environment, target_id, disposable, schema_version,
              migration_sha256, attestation_revision
       from "vision_restore_target_attestation"`,
    );
  } catch {
    throw new Error("Backup restore target attestation is unavailable.");
  }
  if (result.rows.length !== 1) {
    throw new Error("Backup restore target attestation is invalid.");
  }
  const row = result.rows[0]!;
  const schemaVersion = Number(row.schema_version);
  if (
    row.environment !== "preview" ||
    row.environment !== expected.environment ||
    row.target_id !== expected.targetId ||
    row.disposable !== true ||
    expected.disposable !== true ||
    schemaVersion !== BACKUP_SCHEMA_VERSION ||
    row.migration_sha256 !== BACKUP_SCHEMA_MIGRATION_SHA256 ||
    typeof row.attestation_revision !== "string" ||
    !/^[A-Za-z0-9._:-]{1,128}$/u.test(row.attestation_revision)
  ) {
    throw new Error("Backup restore target attestation is invalid.");
  }
  return Object.freeze({
    environment: "preview",
    targetId: expected.targetId,
    disposable: true,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    revision: row.attestation_revision,
  });
}

/** Builds exact-column, primary-key-ordered projections for every authoritative table. */
function backupSnapshotQueries(): readonly BackupSnapshotQuery[] {
  return BACKUP_TABLES.map((table) => {
    const columns = BACKUP_TABLE_COLUMNS[table];
    const order = BACKUP_SCHEMA_CONTRACT[table].primaryKey;
    return Object.freeze({
      table,
      sql: `select ${columns.map(quotedIdentifier).join(", ")}
            from ${publicTable(table)}
            order by ${order.map(quotedIdentifier).join(", ")}`,
    });
  });
}

/** Reads all table counts in one statement and validates safe integer results. */
async function readRowCounts(
  client: PostgresClientPort,
  tableName: (table: BackupTableName) => string,
): Promise<BackupRowCounts> {
  const result = await client.query<Record<BackupTableName, unknown>>(
    `select ${BACKUP_TABLES.map(
      (table) =>
        `(select count(*) from ${tableName(table)}) as ${quotedIdentifier(table)}`,
    ).join(", ")}`,
  );
  const row = result.rows[0];
  if (!row) throw new Error("Backup restore row counts are unavailable.");
  const counts = Object.fromEntries(
    BACKUP_TABLES.map((table) => {
      const count = Number(row[table]);
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error("Backup restore row counts are invalid.");
      }
      return [table, count];
    }),
  ) as Record<BackupTableName, number>;
  return Object.freeze(counts);
}

/** Converts a validated backup value to the driver's expected PostgreSQL parameter form. */
function postgresParameter(
  value: BackupValue,
  kind: string,
): unknown {
  if (kind === "jsonb") return JSON.stringify(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  return value;
}

/** Quotes one compile-time schema identifier without accepting dynamic syntax. */
function quotedIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]*$/u.test(identifier)) {
    throw new Error("Backup database identifier is invalid.");
  }
  return `"${identifier}"`;
}

/** Qualifies one authoritative table in the public schema. */
function publicTable(table: BackupTableName): string {
  return `"public".${quotedIdentifier(table)}`;
}

/** Validates the operator's expected preview-only adapter identity. */
function validateTargetIdentity(identity: BackupRestoreTargetIdentity): void {
  if (
    identity.environment !== "preview" ||
    identity.disposable !== true ||
    !/^[A-Za-z0-9_-]{1,128}$/u.test(identity.targetId)
  ) {
    throw new Error("Backup restore target identity is invalid.");
  }
}

/** Generates a high-entropy identifier safe for temporary SQL names and reports. */
function randomOpaque(bytes: number): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Generates lowercase hexadecimal entropy suitable for a quoted temporary identifier. */
function randomSqlToken(bytes: number): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(bytes)),
    (value) => value.toString(16).padStart(2, "0"),
  ).join("");
}
