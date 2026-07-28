/** Owns the bounded read-only database and R2 foundation-probe boundary. */
import { Pool } from "@neondatabase/serverless";
import { parseEncryptedBackup } from "../crypto/backup-envelope";
import {
  decodeBase64Url,
  encodeBase64Url,
} from "../crypto/envelope";
import { sha256Base64Url } from "./backup/export-backup";
import {
  BACKUP_SCHEMA_CONTRACT,
  BACKUP_TABLES,
  type BackupColumnKind,
} from "../domain/backup/schema-contract";
import { BACKUP_FORMAT_V1 } from "../domain/backup/manifest";
import {
  isCompletePhaseBPrivilegeManifest,
  type PhaseBPrivilegeManifest,
} from "../domain/operations/phase-b-privilege-manifest";
import { BACKUP_OBJECT_PREFIX } from "../jobs/create-daily-backup";

const CONFIGURATION_ERROR =
  "Phase B foundation probe configuration is invalid.";
const SOURCE_ERROR = "Phase B foundation probe source failed.";
const R2_PAGE_LIMIT = 100;
const R2_PAGE_CAP = 100;
const R2_OBJECT_CAP = 10_000;
const SENTINEL_PAST_WINDOW_MILLISECONDS = 15 * 60 * 1_000;
const SENTINEL_FUTURE_WINDOW_MILLISECONDS = 60 * 1_000;
const SHA256_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const METADATA_KEYS = [
  "ciphertextSha256",
  "createdDate",
  "format",
  "keyVersion",
] as const;

/** Fixed public acceptance marker; it is encoded into fresh mutable bytes per use. */
export const PHASE_B_FOUNDATION_SENTINEL_MARKER =
  "VISION_PHASE_B_FOUNDATION_ACCEPTANCE_V1";

/** Closed adapter failure vocabulary that may cross into the evidence job. */
export type PhaseBFoundationProbeSourceFailureCategory =
  | "database_unavailable"
  | "r2_unavailable"
  | "numeric_bound_exceeded";

/** Error boundary that retains only an allowlisted source failure category. */
export class PhaseBFoundationProbeSourceError extends Error {
  readonly category: PhaseBFoundationProbeSourceFailureCategory;

  constructor(category: PhaseBFoundationProbeSourceFailureCategory) {
    super(SOURCE_ERROR);
    this.name = "PhaseBFoundationProbeSourceError";
    this.category = category;
  }
}

/** Minimal retained PostgreSQL client used by the one-shot probe. */
export interface PhaseBFoundationProbeClientPort {
  query<Row extends Record<string, unknown>>(
    statement: string,
    parameters: readonly unknown[],
  ): Promise<{ readonly rows: readonly Row[] }>;
  release(): void;
}

/** One-client pool boundary; closing it is mandatory on every outcome. */
export interface PhaseBFoundationProbePoolPort {
  connect(): Promise<PhaseBFoundationProbeClientPort>;
  end(): Promise<void>;
}

/** Safe R2 object facts admitted internally without returning an object key. */
export interface PhaseBFoundationProbeObject {
  readonly key: string;
  readonly size: number;
  readonly bodySha256?: string;
  readonly customMetadata: Readonly<Record<string, string>>;
}

/** Safe R2 object body retained only while validating one required backup. */
export interface PhaseBFoundationProbeObjectBody
  extends PhaseBFoundationProbeObject {
  readonly body: Uint8Array;
}

/** Read-only, bounded R2 boundary with no put or delete capability. */
export interface PhaseBFoundationProbeBucketPort {
  list(input: {
    readonly prefix: typeof BACKUP_OBJECT_PREFIX;
    readonly limit: 100;
    readonly cursor?: string;
  }): Promise<{
    readonly objects: readonly PhaseBFoundationProbeObject[];
    readonly truncated: boolean;
    readonly cursor?: string;
  }>;
  get(key: string): Promise<PhaseBFoundationProbeObjectBody | null>;
}

/** Encrypted candidate facts kept inside the controlled title boundary. */
export interface PhaseBFoundationProbeSentinelCandidate
  extends Readonly<Record<string, unknown>> {
  readonly ownerId: string;
  readonly nodeId: string;
  readonly domain: "school" | "work" | "personal" | "unresolved";
  readonly titleEnvelope: Uint8Array;
}

/** Inputs admitted before any database or R2 operation is possible. */
export interface CreatePhaseBFoundationProbeSourceInput {
  readonly pool: PhaseBFoundationProbePoolPort;
  readonly bucket: PhaseBFoundationProbeBucketPort;
  readonly privilegeManifest: PhaseBPrivilegeManifest | undefined;
  readonly ownerId: string;
  readonly decryptControlledTitle: (
    candidate: PhaseBFoundationProbeSentinelCandidate,
  ) => Promise<Uint8Array>;
}

/** Aggregate-only facts returned to the closed evidence job. */
export interface PhaseBFoundationProbeSourceMeasurements {
  readonly roleMatches: boolean;
  readonly schemaMatches: boolean;
  readonly privilegesMatch: boolean;
  readonly publicGrantCount: number;
  readonly identityViolations: number;
  readonly domainViolations: number;
  readonly privacyViolations: number;
  readonly provenanceViolations: number;
  readonly referenceViolations: number;
  readonly checkpointViolations: number;
  readonly protectedStorageMatches: boolean;
  readonly sentinelStatus: "passed" | "failed" | "not_tested";
  readonly backupContractMatches: boolean;
  readonly databaseBytes: number;
  readonly r2ObjectCount: number;
  readonly r2Bytes: number;
}

/** One-shot source exposed to the preview-only foundation job. */
export interface PhaseBFoundationProbeSource {
  read(observedAt: Date): Promise<PhaseBFoundationProbeSourceMeasurements>;
}

type AggregateRow = Readonly<Record<string, unknown>>;
type SentinelRow = Readonly<Record<string, unknown>>;

const FOUNDATION_AGGREGATE_QUERY = `
/* phase_b_foundation_aggregates */
with expected_columns as (
  select *
  from jsonb_to_recordset($1::jsonb) as expected(
    table_name text,
    column_name text,
    data_type text,
    is_nullable text
  )
),
actual_columns as (
  select table_name, column_name, data_type, is_nullable
  from information_schema.columns
  where table_schema = $4::text
    and table_name = any($5::text[])
),
expected_tables as (
  select *
  from jsonb_to_recordset(($3::jsonb)->'tables') as expected(
    table_name text,
    owner_name text,
    privileges jsonb,
    grant_options jsonb
  )
),
expected_schema as (
  select *
  from jsonb_to_record($3::jsonb) as expected(
    schema_owner text,
    schema_privileges jsonb,
    schema_grant_options jsonb
  )
),
table_privilege_checks as (
  select
    expected.table_name,
    privilege.name as privilege_name,
    expected.privileges ? privilege.name as expected_effective,
    expected.grant_options ? privilege.name as expected_grant_option,
    has_table_privilege(
      $2::text,
      to_regclass(format('%I.%I', $4::text, expected.table_name)),
      privilege.name
    ) as actual_effective,
    has_table_privilege(
      $2::text,
      to_regclass(format('%I.%I', $4::text, expected.table_name)),
      privilege.name || ' WITH GRANT OPTION'
    ) as actual_grant_option
  from expected_tables expected
  cross join unnest(
    array['DELETE','INSERT','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']
  ) as privilege(name)
),
owner_checks as (
  select expected.table_name,
    pg_get_userbyid(class.relowner) = expected.owner_name as owner_matches
  from expected_tables expected
  left join pg_namespace namespace on namespace.nspname = $4::text
  left join pg_class class
    on class.relnamespace = namespace.oid
   and class.relname = expected.table_name
   and class.relkind in ('r', 'p')
),
schema_privilege_checks as (
  select
    privilege.name as privilege_name,
    expected.schema_privileges ? privilege.name as expected_effective,
    expected.schema_grant_options ? privilege.name as expected_grant_option,
    has_schema_privilege(
      $2::text,
      to_regnamespace($4::text),
      privilege.name
    ) as actual_effective,
    has_schema_privilege(
      $2::text,
      to_regnamespace($4::text),
      privilege.name || ' WITH GRANT OPTION'
    ) as actual_grant_option
  from expected_schema expected
  cross join unnest(array['CREATE','USAGE']) as privilege(name)
),
schema_owner_checks as (
  select
    pg_get_userbyid(namespace.nspowner) = expected.schema_owner as owner_matches
  from expected_schema expected
  left join pg_namespace namespace on namespace.nspname = $4::text
)
select
  current_user = $2::text as role_matches,
  (
    select count(*)
    from (
      select
        coalesce(expected.table_name, actual.table_name) as table_name,
        coalesce(expected.column_name, actual.column_name) as column_name
      from expected_columns expected
      full join actual_columns actual
        on actual.table_name = expected.table_name
       and actual.column_name = expected.column_name
       and actual.data_type = expected.data_type
       and actual.is_nullable = expected.is_nullable
      where expected.table_name is null or actual.table_name is null
    ) mismatches
  ) as schema_mismatch_count,
  (
    (
      select count(*) filter (
        where expected_effective is distinct from actual_effective
           or expected_grant_option is distinct from actual_grant_option
      )
      from table_privilege_checks
    )
    + (
      select count(*) filter (where owner_matches is not true)
      from owner_checks
    )
    + (
      select count(*) filter (
        where expected_effective is distinct from actual_effective
           or expected_grant_option is distinct from actual_grant_option
      )
      from schema_privilege_checks
    )
    + (
      select count(*) filter (where owner_matches is not true)
      from schema_owner_checks
    )
  ) as privilege_mismatch_count,
  (
    select count(*)
    from information_schema.table_privileges
    where grantee = 'PUBLIC'
      and table_schema = $4::text
      and table_name = any($5::text[])
  ) as public_grant_count,
  (
    select count(*)
    from nodes
    where owner_id = $6::text
      and (
        owner_id = ''
        or provider = ''
        or provider_node_id = ''
        or identity_kind not in ('provider', 'first_party', 'system')
      )
  ) as identity_violations,
  (
    select count(*)
    from nodes
    where owner_id = $6::text
      and (
        domain not in ('school', 'work', 'personal', 'unresolved')
        or domain_state not in ('confirmed', 'inferred', 'unresolved')
        or ((domain = 'unresolved') is distinct from (domain_state = 'unresolved'))
      )
  ) as domain_violations,
  (
    select count(*)
    from edges edge
    inner join nodes source
      on source.id = edge.source_node_id
     and source.owner_id = edge.owner_id
    inner join nodes destination
      on destination.id = edge.destination_node_id
     and destination.owner_id = edge.owner_id
    where edge.owner_id = $6::text
      and (
        edge.privacy not in ('planning', 'private', 'restricted')
        or array_position(
          array['planning','private','restricted'],
          edge.privacy
        ) < array_position(
          array['planning','private','restricted'],
          source.privacy
        )
        or array_position(
          array['planning','private','restricted'],
          edge.privacy
        ) < array_position(
          array['planning','private','restricted'],
          destination.privacy
        )
      )
  ) as privacy_violations,
  (
    select count(*)
    from nodes node
    left join events event
      on event.node_id = node.id
     and event.owner_id = node.owner_id
    where node.owner_id = $6::text
      and node.provider = 'google-calendar'
      and (
        node.provenance <> 'provider'
        or node.node_type = 'event' and (
          event.node_id is null
          or event.provider <> 'google-calendar'
          or event.provider_calendar_id = ''
          or event.provider_event_id = ''
          or event.provider_version = ''
        )
      )
  ) as provenance_violations,
  (
    select count(*)
    from edges edge
    left join nodes source
      on source.id = edge.source_node_id
     and source.owner_id = edge.owner_id
     and source.node_type = edge.source_node_type
    left join nodes destination
      on destination.id = edge.destination_node_id
     and destination.owner_id = edge.owner_id
     and destination.node_type = edge.destination_node_type
    where edge.owner_id = $6::text
      and (source.id is null or destination.id is null)
  ) as reference_violations,
  (
    select count(*)
    from sync_checkpoints checkpoint
    where checkpoint.owner_id = $6::text
      and (
        checkpoint.provider <> 'google-calendar'
        or checkpoint.provider_calendar_id = ''
        or checkpoint.version < 0
        or (
          checkpoint.version = 0
          and (
            checkpoint.sync_token_envelope is not null
            or checkpoint.key_version is not null
          )
        )
        or (
          checkpoint.version > 0
          and (
            checkpoint.sync_token_envelope is null
            or checkpoint.key_version is null
            or checkpoint.key_version <= 0
          )
        )
      )
  ) as checkpoint_violations,
  (
    select
      count(*) filter (
        where column_name in (
          'title','description','attendees','location','meeting_link'
        )
      )
      + count(*) filter (
          where column_name in (
            'title_envelope','description_envelope','attendees_envelope',
            'location_envelope','meeting_link_envelope'
          )
            and data_type <> 'bytea'
        )
    from information_schema.columns
    where table_schema = $4::text
      and table_name = 'events'
  ) as protected_storage_mismatch_count,
  pg_database_size(current_database()) as database_bytes
`;

const FOUNDATION_SENTINEL_QUERY = `
/* phase_b_foundation_sentinel */
select
  node.id as node_id,
  node.owner_id,
  node.domain,
  event.title_envelope
from nodes node
inner join events event
  on event.node_id = node.id
 and event.owner_id = node.owner_id
 and event.provider = 'google-calendar'
where node.owner_id = $1::text
  and node.lifecycle = 'active'
  and node.provider = 'google-calendar'
  and node.node_type = 'event'
  and node.created_at >= $2::timestamptz
  and node.created_at <= $3::timestamptz
order by node.created_at, node.id
limit 2
`;

/** Creates the production max-one Neon pool without exposing its connection value. */
export function createNeonPhaseBFoundationProbePool(
  connectionString: string,
): PhaseBFoundationProbePoolPort {
  const pool = new Pool({ connectionString, max: 1 });
  return {
    /** Retains the sole configured Neon client until the one-shot read ends. */
    async connect(): Promise<PhaseBFoundationProbeClientPort> {
      const client = await pool.connect();
      return {
        /** Executes one parameterized read and projects only its row array. */
        async query<Row extends Record<string, unknown>>(
          statement: string,
          parameters: readonly unknown[],
        ) {
          const result = await client.query(statement, [...parameters]);
          return { rows: result.rows as readonly Row[] };
        },
        /** Releases the retained client exactly once through the source cleanup path. */
        release() {
          client.release();
        },
      };
    },
    /** Closes the max-one pool after every source outcome. */
    async end() {
      await pool.end();
    },
  };
}

/** Creates the production read-only R2 adapter without put or delete capability. */
export function createR2PhaseBFoundationProbeBucket(
  bucket: R2Bucket,
): PhaseBFoundationProbeBucketPort {
  return {
    /** Lists one bounded metadata-only page under the fixed backup prefix. */
    async list(input) {
      const page = await bucket.list({
        prefix: input.prefix,
        limit: input.limit,
        ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
        include: ["customMetadata"],
      });
      const cursor = page.truncated ? page.cursor : undefined;
      return {
        objects: page.objects.map(toProbeObject),
        truncated: page.truncated,
        ...(cursor ? { cursor } : {}),
      };
    },
    /** Reads the one required-date encrypted backup candidate for validation. */
    async get(key) {
      const object = await bucket.get(key);
      if (!object) return null;
      return {
        ...toProbeObject(object),
        body: new Uint8Array(await object.bytes()),
      };
    },
  };
}

/** Creates the aggregate source after strict configuration admission. */
export function createPhaseBFoundationProbeSource(
  input: CreatePhaseBFoundationProbeSourceInput,
): PhaseBFoundationProbeSource {
  if (
    !isCompletePhaseBPrivilegeManifest(input.privilegeManifest) ||
    !isNonemptyText(input.ownerId) ||
    typeof input.pool?.connect !== "function" ||
    typeof input.pool?.end !== "function" ||
    typeof input.bucket?.list !== "function" ||
    typeof input.bucket?.get !== "function" ||
    typeof input.decryptControlledTitle !== "function"
  ) {
    throw new Error(CONFIGURATION_ERROR);
  }
  const privilegeManifest = cloneManifest(input.privilegeManifest);
  const ownerId = input.ownerId;

  return Object.freeze({
    /** Runs one preview observation and returns aggregate-only measurements. */
    async read(
      observedAt: Date,
    ): Promise<PhaseBFoundationProbeSourceMeasurements> {
      const observedTime = Date.prototype.getTime.call(observedAt);
      if (!Number.isFinite(observedTime)) {
        throw new PhaseBFoundationProbeSourceError(
          "database_unavailable",
        );
      }
      let client: PhaseBFoundationProbeClientPort | undefined;
      let database:
        | Omit<
            PhaseBFoundationProbeSourceMeasurements,
            "backupContractMatches" | "r2ObjectCount" | "r2Bytes"
          >
        | undefined;
      let databaseFailure:
        | PhaseBFoundationProbeSourceFailureCategory
        | undefined;
      try {
        client = await input.pool.connect();
        const aggregateResult = await client.query<AggregateRow>(
          FOUNDATION_AGGREGATE_QUERY,
          [
            JSON.stringify(schemaColumnExpectations()),
            privilegeManifest.role,
            JSON.stringify(privilegeQueryParameter(privilegeManifest)),
            privilegeManifest.schema,
            [...BACKUP_TABLES],
            ownerId,
          ],
        );
        const sentinelResult = await client.query<SentinelRow>(
          FOUNDATION_SENTINEL_QUERY,
          [
            ownerId,
            new Date(observedTime - SENTINEL_PAST_WINDOW_MILLISECONDS),
            new Date(observedTime + SENTINEL_FUTURE_WINDOW_MILLISECONDS),
          ],
        );
        database = {
          ...decodeAggregateRow(aggregateResult.rows),
          sentinelStatus: await evaluateSentinel(
            sentinelResult.rows,
            ownerId,
            input.decryptControlledTitle,
          ),
        };
      } catch (error) {
        databaseFailure =
          error instanceof PhaseBFoundationProbeSourceError
            ? error.category
            : "database_unavailable";
      } finally {
        if (client) {
          try {
            client.release();
          } catch {
            databaseFailure = "database_unavailable";
          }
        }
        try {
          await input.pool.end();
        } catch {
          databaseFailure = "database_unavailable";
        }
      }
      if (databaseFailure) {
        throw new PhaseBFoundationProbeSourceError(databaseFailure);
      }
      if (!database) {
        throw new PhaseBFoundationProbeSourceError(
          "database_unavailable",
        );
      }

      const requiredDate = Date.prototype.toISOString
        .call(observedAt)
        .slice(0, 10);
      const r2 = await readR2Measurements(
        input.bucket,
        requiredDate,
        database.sentinelStatus !== "not_tested",
      );
      return Object.freeze({
        ...database,
        protectedStorageMatches:
          database.protectedStorageMatches && r2.markerAbsent,
        backupContractMatches: r2.backupContractMatches,
        r2ObjectCount: r2.r2ObjectCount,
        r2Bytes: r2.r2Bytes,
      });
    },
  });
}

/** Converts migration-9 columns into PostgreSQL information-schema signatures. */
function schemaColumnExpectations(): readonly Readonly<{
  readonly table_name: string;
  readonly column_name: string;
  readonly data_type: string;
  readonly is_nullable: "YES" | "NO";
}>[] {
  return BACKUP_TABLES.flatMap((table) =>
    Object.entries(BACKUP_SCHEMA_CONTRACT[table].columns).map(
      ([column, contract]) => ({
        table_name: table,
        column_name: column,
        data_type: informationSchemaType(contract.kind),
        is_nullable: contract.nullable ? "YES" as const : "NO" as const,
      }),
    ),
  );
}

/** Maps the production schema contract to information_schema data types. */
function informationSchemaType(kind: BackupColumnKind): string {
  if (kind === "timestamptz") return "timestamp with time zone";
  return kind;
}

/** Shapes only values needed by the server-side effective privilege aggregate. */
function privilegeQueryParameter(manifest: PhaseBPrivilegeManifest): {
  readonly schema_owner: string;
  readonly schema_privileges: readonly string[];
  readonly schema_grant_options: readonly string[];
  readonly tables: readonly Readonly<{
    readonly table_name: string;
    readonly owner_name: string;
    readonly privileges: readonly string[];
    readonly grant_options: readonly string[];
  }>[];
} {
  return {
    schema_owner: manifest.schemaOwner,
    schema_privileges: manifest.schemaPrivileges,
    schema_grant_options: manifest.schemaGrantOptions,
    tables: manifest.tables.map((table) => ({
      table_name: table.table,
      owner_name: table.owner,
      privileges: table.privileges,
      grant_options: table.grantOptions,
    })),
  };
}

/** Converts the one aggregate row into bounded evidence facts. */
function decodeAggregateRow(
  rows: readonly AggregateRow[],
): Omit<
  PhaseBFoundationProbeSourceMeasurements,
  "sentinelStatus" | "backupContractMatches" | "r2ObjectCount" | "r2Bytes"
> {
  if (rows.length !== 1 || rows[0]?.role_matches !== true) {
    const row = rows[0];
    if (!row || typeof row.role_matches !== "boolean") {
      throw new PhaseBFoundationProbeSourceError(
        "database_unavailable",
      );
    }
  }
  const row = rows[0]!;
  const schemaMismatchCount = decodeSafeInteger(
    row.schema_mismatch_count,
  );
  const privilegeMismatchCount = decodeSafeInteger(
    row.privilege_mismatch_count,
  );
  const protectedStorageMismatchCount = decodeSafeInteger(
    row.protected_storage_mismatch_count,
  );
  return {
    roleMatches: row.role_matches === true,
    schemaMatches: schemaMismatchCount === 0,
    privilegesMatch: privilegeMismatchCount === 0,
    publicGrantCount: decodeSafeInteger(row.public_grant_count),
    identityViolations: decodeSafeInteger(row.identity_violations),
    domainViolations: decodeSafeInteger(row.domain_violations),
    privacyViolations: decodeSafeInteger(row.privacy_violations),
    provenanceViolations: decodeSafeInteger(row.provenance_violations),
    referenceViolations: decodeSafeInteger(row.reference_violations),
    checkpointViolations: decodeSafeInteger(row.checkpoint_violations),
    protectedStorageMatches: protectedStorageMismatchCount === 0,
    databaseBytes: decodeSafeInteger(row.database_bytes),
  };
}

/** Runs only the unique controlled title comparison and clears both byte buffers. */
async function evaluateSentinel(
  rows: readonly SentinelRow[],
  ownerId: string,
  decryptControlledTitle: (
    candidate: PhaseBFoundationProbeSentinelCandidate,
  ) => Promise<Uint8Array>,
): Promise<"passed" | "failed" | "not_tested"> {
  if (rows.length !== 1) return "not_tested";
  const row = rows[0]!;
  if (row.title_envelope === null) return "not_tested";
  const candidate = decodeSentinelCandidate(row, ownerId);
  if (!candidate) return "not_tested";

  const expected = new TextEncoder().encode(
    PHASE_B_FOUNDATION_SENTINEL_MARKER,
  );
  let plaintext: Uint8Array | undefined;
  try {
    plaintext = await decryptControlledTitle(candidate);
    if (!(plaintext instanceof Uint8Array)) return "failed";
    return equalBytes(plaintext, expected) ? "passed" : "failed";
  } catch {
    return "failed";
  } finally {
    plaintext?.fill(0);
    expected.fill(0);
  }
}

/** Admits the only row shape allowed to enter the controlled decrypt boundary. */
function decodeSentinelCandidate(
  row: SentinelRow,
  ownerId: string,
): PhaseBFoundationProbeSentinelCandidate | undefined {
  if (
    row.owner_id !== ownerId ||
    !isNonemptyText(row.node_id) ||
    (row.domain !== "school" &&
      row.domain !== "work" &&
      row.domain !== "personal" &&
      row.domain !== "unresolved") ||
    !(row.title_envelope instanceof Uint8Array)
  ) {
    return undefined;
  }
  return Object.freeze({
    ownerId,
    nodeId: row.node_id,
    domain: row.domain,
    titleEnvelope: row.title_envelope,
  });
}

/** Compares mutable bytes without converting either buffer to text. */
function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.byteLength ^ right.byteLength;
  const length = Math.max(left.byteLength, right.byteLength);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

/** Lists the fixed backup prefix within the controller-approved hard bounds. */
async function readR2Measurements(
  bucket: PhaseBFoundationProbeBucketPort,
  requiredDate: string,
  sentinelActive: boolean,
): Promise<{
  readonly backupContractMatches: boolean;
  readonly markerAbsent: boolean;
  readonly r2ObjectCount: number;
  readonly r2Bytes: number;
}> {
  let cursor: string | undefined;
  let r2ObjectCount = 0;
  let r2Bytes = 0;
  const observedCursors = new Set<string>();
  const required: PhaseBFoundationProbeObject[] = [];
  try {
    for (let pageNumber = 0; pageNumber < R2_PAGE_CAP; pageNumber += 1) {
      const page = await bucket.list({
        prefix: BACKUP_OBJECT_PREFIX,
        limit: R2_PAGE_LIMIT,
        ...(cursor === undefined ? {} : { cursor }),
      });
      if (
        !Array.isArray(page.objects) ||
        page.objects.length > R2_PAGE_LIMIT ||
        typeof page.truncated !== "boolean"
      ) {
        throw new PhaseBFoundationProbeSourceError("r2_unavailable");
      }
      for (const object of page.objects) {
        if (
          !isNonemptyText(object.key) ||
          !Number.isSafeInteger(object.size) ||
          object.size < 0 ||
          r2ObjectCount >= R2_OBJECT_CAP
        ) {
          throw new PhaseBFoundationProbeSourceError(
            !Number.isSafeInteger(object.size) || object.size < 0
              ? "numeric_bound_exceeded"
              : "r2_unavailable",
          );
        }
        if (object.size > Number.MAX_SAFE_INTEGER - r2Bytes) {
          throw new PhaseBFoundationProbeSourceError(
            "numeric_bound_exceeded",
          );
        }
        r2ObjectCount += 1;
        r2Bytes += object.size;
        if (object.customMetadata?.createdDate === requiredDate) {
          required.push(object);
        }
      }
      if (!page.truncated) {
        const contract =
          required.length === 1
            ? await validateStoredBackup(
                bucket,
                required[0]!,
                requiredDate,
                sentinelActive,
              )
            : { matches: false, markerAbsent: !sentinelActive };
        return {
          backupContractMatches: contract.matches,
          markerAbsent: contract.markerAbsent,
          r2ObjectCount,
          r2Bytes,
        };
      }
      if (
        pageNumber === R2_PAGE_CAP - 1 ||
        typeof page.cursor !== "string" ||
        page.cursor.length === 0 ||
        page.cursor.length > 2_048 ||
        observedCursors.has(page.cursor)
      ) {
        throw new PhaseBFoundationProbeSourceError("r2_unavailable");
      }
      observedCursors.add(page.cursor);
      cursor = page.cursor;
    }
  } catch (error) {
    if (error instanceof PhaseBFoundationProbeSourceError) throw error;
    throw new PhaseBFoundationProbeSourceError("r2_unavailable");
  }
  throw new PhaseBFoundationProbeSourceError("r2_unavailable");
}

/** Validates exact metadata, native checksum, envelope, and ciphertext digest shape. */
async function validateStoredBackup(
  bucket: PhaseBFoundationProbeBucketPort,
  listed: PhaseBFoundationProbeObject,
  requiredDate: string,
  sentinelActive: boolean,
): Promise<{ readonly matches: boolean; readonly markerAbsent: boolean }> {
  if (
    !validMetadata(listed.customMetadata, requiredDate) ||
    typeof listed.bodySha256 !== "string" ||
    !SHA256_PATTERN.test(listed.bodySha256)
  ) {
    return { matches: false, markerAbsent: !sentinelActive };
  }
  let object: PhaseBFoundationProbeObjectBody | null;
  try {
    object = await bucket.get(listed.key);
  } catch {
    throw new PhaseBFoundationProbeSourceError("r2_unavailable");
  }
  if (!object) {
    return { matches: false, markerAbsent: !sentinelActive };
  }
  try {
    if (
      object.key !== listed.key ||
      object.size !== listed.size ||
      object.body.byteLength !== listed.size ||
      object.bodySha256 !== listed.bodySha256 ||
      !sameMetadata(object.customMetadata, listed.customMetadata)
    ) {
      return { matches: false, markerAbsent: !sentinelActive };
    }
    const actualBodySha256 = await sha256Base64Url(object.body);
    if (actualBodySha256 !== listed.bodySha256) {
      return { matches: false, markerAbsent: !sentinelActive };
    }
    const serialized = new TextDecoder("utf-8", { fatal: true }).decode(
      object.body,
    );
    const encrypted = parseEncryptedBackup(serialized);
    if (
      encrypted.format !== "vision-backup-envelope" ||
      encrypted.version !== 1 ||
      encrypted.algorithm !== "A256GCM" ||
      encrypted.keyVersion !== 1
    ) {
      return { matches: false, markerAbsent: !sentinelActive };
    }
    const ciphertextSha256 = await sha256Base64Url(
      decodeBase64Url(
        encrypted.ciphertext,
        "Foundation backup ciphertext",
        encrypted.ciphertext.length,
      ),
    );
    const marker = sentinelActive
      ? new TextEncoder().encode(PHASE_B_FOUNDATION_SENTINEL_MARKER)
      : undefined;
    try {
      const markerAbsent =
        marker === undefined || !containsBytes(object.body, marker);
      return {
        matches:
          markerAbsent &&
          ciphertextSha256 ===
            listed.customMetadata.ciphertextSha256,
        markerAbsent,
      };
    } finally {
      marker?.fill(0);
    }
  } catch {
    return { matches: false, markerAbsent: !sentinelActive };
  }
}

/** Requires the exact backup-creation metadata contract and key version 1. */
function validMetadata(
  metadata: Readonly<Record<string, string>>,
  requiredDate: string,
): boolean {
  const keys = Object.keys(metadata).sort();
  return (
    keys.length === METADATA_KEYS.length &&
    keys.every((key, index) => key === METADATA_KEYS[index]) &&
    metadata.format === BACKUP_FORMAT_V1 &&
    metadata.createdDate === requiredDate &&
    metadata.keyVersion === "1" &&
    typeof metadata.ciphertextSha256 === "string" &&
    SHA256_PATTERN.test(metadata.ciphertextSha256)
  );
}

/** Compares two exact already-bounded custom metadata records. */
function sameMetadata(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && left[key] === right[key],
    )
  );
}

/** Tests whether a public marker byte sequence appears in encrypted storage. */
function containsBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.byteLength === 0 || needle.byteLength > haystack.byteLength) {
    return false;
  }
  for (
    let offset = 0;
    offset <= haystack.byteLength - needle.byteLength;
    offset += 1
  ) {
    let matches = true;
    for (let index = 0; index < needle.byteLength; index += 1) {
      if (haystack[offset + index] !== needle[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

/** Admits database bigints only as canonical nonnegative safe integers. */
function decodeSafeInteger(candidate: unknown): number {
  const decoded =
    typeof candidate === "string" &&
    /^(?:0|[1-9]\d*)$/u.test(candidate)
      ? Number(candidate)
      : candidate;
  if (
    typeof decoded !== "number" ||
    !Number.isSafeInteger(decoded) ||
    decoded < 0
  ) {
    throw new PhaseBFoundationProbeSourceError(
      "numeric_bound_exceeded",
    );
  }
  return decoded;
}

/** Converts a native R2 object to the read-only internal shape. */
function toProbeObject(object: R2Object): PhaseBFoundationProbeObject {
  const checksum = object.checksums.sha256;
  return Object.freeze({
    key: object.key,
    size: object.size,
    customMetadata: Object.freeze({ ...(object.customMetadata ?? {}) }),
    ...(checksum
      ? {
          bodySha256: encodeBase64Url(new Uint8Array(checksum)),
        }
      : {}),
  });
}

/** Clones the already validated controller manifest before retaining it. */
function cloneManifest(
  manifest: PhaseBPrivilegeManifest,
): PhaseBPrivilegeManifest {
  return Object.freeze({
    role: manifest.role,
    schema: manifest.schema,
    schemaOwner: manifest.schemaOwner,
    schemaPrivileges: Object.freeze([...manifest.schemaPrivileges]),
    schemaGrantOptions: Object.freeze([...manifest.schemaGrantOptions]),
    tables: Object.freeze(
      manifest.tables.map((table) =>
        Object.freeze({
          table: table.table,
          owner: table.owner,
          privileges: Object.freeze([...table.privileges]),
          grantOptions: Object.freeze([...table.grantOptions]),
        }),
      ),
    ),
  });
}

/** Requires one bounded nonempty string without copying it into evidence. */
function isNonemptyText(candidate: unknown): candidate is string {
  return (
    typeof candidate === "string" &&
    candidate.length > 0 &&
    candidate.length <= 2_048 &&
    !candidate.includes("\u0000")
  );
}
