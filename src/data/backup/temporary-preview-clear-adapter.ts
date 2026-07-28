/** Clears one attested disposable preview target behind the one-shot R2 fence. */
import { Pool } from "@neondatabase/serverless";
import {
  BACKUP_SCHEMA_MIGRATION_SHA256,
} from "../../domain/backup/schema-contract";
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  type BackupRowCounts,
  type BackupTableName,
} from "../../domain/backup/manifest";
import { parseVisionDatabaseUrl } from "../../server/env";

const EXPECTED_TOTAL_ROWS = 51;
const EXPECTED_NONEMPTY_TABLES = 13;
const EXPECTED_EVENT_ROWS = 0;
const CLOSED_CLEAR_ERROR = "Temporary preview target clear failed.";

/** Minimal retained PostgreSQL session used by the temporary clear. */
export interface TemporaryPreviewClearClientPort {
  query<Row extends Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<{ readonly rows: readonly Row[] }>;
  release(): void;
}

/** One-client pool boundary; closing it is part of every clear outcome. */
export interface TemporaryPreviewClearPoolPort {
  connect(): Promise<TemporaryPreviewClearClientPort>;
  end(): Promise<void>;
}

/** Exact provider-selected identity that must match the database attestation. */
export interface TemporaryPreviewClearTargetIdentity {
  readonly environment: "preview";
  readonly targetId: string;
  readonly disposable: true;
}

/** Value-free postcondition returned only after commit and pool closure. */
export interface TemporaryPreviewClearResult {
  readonly cleared: true;
  readonly authoritativeTableCount: 29;
  readonly totalRows: 0;
  readonly nonemptyTables: 0;
  readonly eventRows: 0;
}

/** One-shot clear operation constructed only after the caller owns the fence. */
export interface TemporaryPreviewClearAdapter {
  clear(expectedRowCounts: BackupRowCounts): Promise<TemporaryPreviewClearResult>;
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
  readonly migrationSha256: typeof BACKUP_SCHEMA_MIGRATION_SHA256;
  readonly revision: string;
}

/** Creates the production max-one Neon pool without exposing its connection value. */
export function createTemporaryPreviewClearAdapter(
  databaseUrl: unknown,
  targetId: string,
): TemporaryPreviewClearAdapter {
  let connectionString: string;
  try {
    connectionString = parseVisionDatabaseUrl(databaseUrl);
  } catch {
    throw new Error("Temporary preview target clear configuration is invalid.");
  }
  const pool = new Pool({ connectionString, max: 1 });
  return createPostgresTemporaryPreviewClearAdapter(
    {
      /** Opens the sole retained client from the max-one production pool. */
      async connect(): Promise<TemporaryPreviewClearClientPort> {
        const client = await pool.connect();
        return {
          /** Executes one parameterized statement without retaining driver output. */
          async query<Row extends Record<string, unknown>>(
            sql: string,
            parameters: readonly unknown[] = [],
          ) {
            const result = await client.query(sql, [...parameters]);
            return { rows: result.rows as readonly Row[] };
          },
          /** Releases the retained client after commit or rollback. */
          release() {
            client.release();
          },
        };
      },
      /** Closes every remaining production connection after the one-shot clear. */
      async end() {
        await pool.end();
      },
    },
    {
      environment: "preview",
      targetId,
      disposable: true,
    },
  );
}

/** Creates the serializable clear engine over one retained client and closable pool. */
export function createPostgresTemporaryPreviewClearAdapter(
  pool: TemporaryPreviewClearPoolPort,
  identity: TemporaryPreviewClearTargetIdentity,
): TemporaryPreviewClearAdapter {
  validateIdentity(identity);
  return {
    /** Runs the complete clear transaction and closes its pool on every path. */
    async clear(
      expectedRowCounts: BackupRowCounts,
    ): Promise<TemporaryPreviewClearResult> {
      let client: TemporaryPreviewClearClientPort | undefined;
      let result: TemporaryPreviewClearResult | undefined;
      let failed = false;
      try {
        client = await pool.connect();
        try {
          await client.query("begin isolation level serializable");
          await requireRestoreRole(client);
          const before = await readAttestation(client, identity, true);
          for (const table of BACKUP_TABLES) {
            await client.query(
              `lock table ${publicTable(table)} in access exclusive mode`,
            );
          }
          requireSameAttestation(
            before,
            await readAttestation(client, identity, false),
          );
          const currentCounts = await readRowCounts(client);
          requireExactPreparedCounts(currentCounts, expectedRowCounts);
          requireExpectedAggregate(currentCounts);

          for (const table of [...BACKUP_TABLES].reverse()) {
            await client.query(`delete from ${publicTable(table)}`);
          }
          const clearedCounts = await readRowCounts(client);
          requireAllZero(clearedCounts);
          requireSameAttestation(
            before,
            await readAttestation(client, identity, false),
          );
          await client.query("commit");
          result = Object.freeze({
            cleared: true,
            authoritativeTableCount: BACKUP_TABLES.length,
            totalRows: 0,
            nonemptyTables: 0,
            eventRows: 0,
          }) as TemporaryPreviewClearResult;
        } catch {
          failed = true;
          try {
            await client.query("rollback");
          } catch {
            // A closed session also rolls back; preserve only the fixed failure.
          }
        }
      } catch {
        failed = true;
      } finally {
        if (client) {
          try {
            client.release();
          } catch {
            failed = true;
          }
        }
        try {
          await pool.end();
        } catch {
          failed = true;
        }
      }
      if (failed || !result) throw new Error(CLOSED_CLEAR_ERROR);
      return result;
    },
  };
}

/** Requires the exact database role before any table lock or count read. */
async function requireRestoreRole(
  client: TemporaryPreviewClearClientPort,
): Promise<void> {
  const result = await client.query<{ readonly current_user: unknown }>(
    'select current_user as "current_user"',
  );
  if (
    result.rows.length !== 1 ||
    result.rows[0]?.current_user !== "vision_app"
  ) {
    throw new Error(CLOSED_CLEAR_ERROR);
  }
}

/** Locks or rereads the sole database-owned preview attestation. */
async function readAttestation(
  client: TemporaryPreviewClearClientPort,
  expected: TemporaryPreviewClearTargetIdentity,
  lock: boolean,
): Promise<ValidatedRestoreTargetAttestation> {
  const result = await client.query<RestoreTargetAttestationRow>(
    `select environment, target_id, disposable, schema_version,
            migration_sha256, attestation_revision
     from "public"."vision_restore_target_attestation"${lock ? " for update" : ""}`,
  );
  if (result.rows.length !== 1) throw new Error(CLOSED_CLEAR_ERROR);
  const row = result.rows[0]!;
  if (
    row.environment !== "preview" ||
    row.environment !== expected.environment ||
    row.target_id !== expected.targetId ||
    row.disposable !== true ||
    expected.disposable !== true ||
    Number(row.schema_version) !== BACKUP_SCHEMA_VERSION ||
    row.migration_sha256 !== BACKUP_SCHEMA_MIGRATION_SHA256 ||
    typeof row.attestation_revision !== "string" ||
    !/^[A-Za-z0-9._:-]{1,128}$/u.test(row.attestation_revision)
  ) {
    throw new Error(CLOSED_CLEAR_ERROR);
  }
  return Object.freeze({
    environment: "preview",
    targetId: expected.targetId,
    disposable: true,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    migrationSha256: BACKUP_SCHEMA_MIGRATION_SHA256,
    revision: row.attestation_revision,
  });
}

/** Requires both protected attestation rereads to equal the locked row exactly. */
function requireSameAttestation(
  expected: ValidatedRestoreTargetAttestation,
  actual: ValidatedRestoreTargetAttestation,
): void {
  if (
    actual.environment !== expected.environment ||
    actual.targetId !== expected.targetId ||
    actual.disposable !== expected.disposable ||
    actual.schemaVersion !== expected.schemaVersion ||
    actual.migrationSha256 !== expected.migrationSha256 ||
    actual.revision !== expected.revision
  ) {
    throw new Error(CLOSED_CLEAR_ERROR);
  }
}

/** Reads all 29 counts in one value-only statement. */
async function readRowCounts(
  client: TemporaryPreviewClearClientPort,
): Promise<BackupRowCounts> {
  const result = await client.query<Record<BackupTableName, unknown>>(
    `select ${BACKUP_TABLES.map(
      (table) =>
        `(select count(*) from ${publicTable(table)}) as ${quotedIdentifier(table)}`,
    ).join(", ")}`,
  );
  if (result.rows.length !== 1) throw new Error(CLOSED_CLEAR_ERROR);
  const row = result.rows[0]!;
  const counts = Object.fromEntries(
    BACKUP_TABLES.map((table) => {
      const count = Number(row[table]);
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error(CLOSED_CLEAR_ERROR);
      }
      return [table, count];
    }),
  ) as Record<BackupTableName, number>;
  return Object.freeze(counts);
}

/** Requires complete per-table equality with the already-prepared manifest. */
function requireExactPreparedCounts(
  actual: BackupRowCounts,
  expected: BackupRowCounts,
): void {
  if (
    typeof expected !== "object" ||
    expected === null ||
    Object.keys(expected).length !== BACKUP_TABLES.length ||
    BACKUP_TABLES.some(
      (table) =>
        !Number.isSafeInteger(expected[table]) ||
        expected[table] < 0 ||
        actual[table] !== expected[table],
    )
  ) {
    throw new Error(CLOSED_CLEAR_ERROR);
  }
}

/** Requires the known retained target aggregate in addition to every manifest count. */
function requireExpectedAggregate(counts: BackupRowCounts): void {
  const totalRows = BACKUP_TABLES.reduce(
    (total, table) => total + counts[table],
    0,
  );
  const nonemptyTables = BACKUP_TABLES.filter(
    (table) => counts[table] > 0,
  ).length;
  if (
    BACKUP_TABLES.length !== 29 ||
    totalRows !== EXPECTED_TOTAL_ROWS ||
    nonemptyTables !== EXPECTED_NONEMPTY_TABLES ||
    counts.events !== EXPECTED_EVENT_ROWS
  ) {
    throw new Error(CLOSED_CLEAR_ERROR);
  }
}

/** Requires all 29 tables to remain locked and empty before commit. */
function requireAllZero(counts: BackupRowCounts): void {
  if (BACKUP_TABLES.some((table) => counts[table] !== 0)) {
    throw new Error(CLOSED_CLEAR_ERROR);
  }
}

/** Validates the exact provider-selected identity without echoing it. */
function validateIdentity(
  identity: TemporaryPreviewClearTargetIdentity,
): void {
  if (
    identity.environment !== "preview" ||
    identity.disposable !== true ||
    !/^[A-Za-z0-9_-]{1,128}$/u.test(identity.targetId)
  ) {
    throw new Error("Temporary preview target clear configuration is invalid.");
  }
}

/** Quotes one compile-time schema identifier. */
function quotedIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]*$/u.test(identifier)) {
    throw new Error(CLOSED_CLEAR_ERROR);
  }
  return `"${identifier}"`;
}

/** Qualifies an authoritative table in the fixed public schema. */
function publicTable(table: BackupTableName): string {
  return `"public".${quotedIdentifier(table)}`;
}
