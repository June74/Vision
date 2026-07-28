/** Probes one disposable preview connection for the dedicated application role. */
import { Pool } from "@neondatabase/serverless";

const ROLE_PROBE_QUERY = "select current_user = 'vision_app' as role_ok";
const CLOSED_ROLE_PROBE_ERROR = "Temporary preview role probe failed.";

/** Minimal retained PostgreSQL session used by the temporary role probe. */
export interface TemporaryPreviewRoleProbeClientPort {
  query<Row extends Record<string, unknown>>(
    sql: string,
  ): Promise<{ readonly rows: readonly Row[] }>;
  release(): void;
}

/** One-client pool boundary; closing it is part of every probe outcome. */
export interface TemporaryPreviewRoleProbePoolPort {
  connect(): Promise<TemporaryPreviewRoleProbeClientPort>;
  end(): Promise<void>;
}

/** Read-only role check exposed to the preview-only scheduled job. */
export interface TemporaryPreviewRoleProbeAdapter {
  probeRole(): Promise<boolean>;
}

/** Creates the production max-one Neon pool without exposing its connection value. */
export function createTemporaryPreviewRoleProbeAdapter(
  connectionString: string,
): TemporaryPreviewRoleProbeAdapter {
  const pool = new Pool({ connectionString, max: 1 });
  return createPostgresTemporaryPreviewRoleProbeAdapter({
    /** Opens the sole retained client from the max-one production pool. */
    async connect(): Promise<TemporaryPreviewRoleProbeClientPort> {
      const client = await pool.connect();
      return {
        /** Executes only the fixed role predicate without retaining driver output. */
        async query<Row extends Record<string, unknown>>(sql: string) {
          const result = await client.query(sql);
          return { rows: result.rows as readonly Row[] };
        },
        /** Releases the retained client after the single read. */
        release() {
          client.release();
        },
      };
    },
    /** Closes every remaining production connection after the one-shot read. */
    async end() {
      await pool.end();
    },
  });
}

/** Creates the testable read-only probe over one retained client and closable pool. */
export function createPostgresTemporaryPreviewRoleProbeAdapter(
  pool: TemporaryPreviewRoleProbePoolPort,
): TemporaryPreviewRoleProbeAdapter {
  return {
    /** Executes one exact role predicate and closes every resource on every path. */
    async probeRole(): Promise<boolean> {
      let client: TemporaryPreviewRoleProbeClientPort | undefined;
      let roleMatches = false;
      let failed = false;
      try {
        client = await pool.connect();
        const result = await client.query<{ readonly role_ok: unknown }>(
          ROLE_PROBE_QUERY,
        );
        roleMatches =
          result.rows.length === 1 && result.rows[0]?.role_ok === true;
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
      if (failed) throw new Error(CLOSED_ROLE_PROBE_ERROR);
      return roleMatches;
    },
  };
}
