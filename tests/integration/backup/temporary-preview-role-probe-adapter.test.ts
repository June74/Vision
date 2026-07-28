import { describe, expect, it, vi } from "vitest";
import {
  createPostgresTemporaryPreviewRoleProbeAdapter,
  type TemporaryPreviewRoleProbeClientPort,
  type TemporaryPreviewRoleProbePoolPort,
} from "../../../src/data/backup/temporary-preview-role-probe-adapter";

const ROLE_QUERY = "select current_user = 'vision_app' as role_ok";
const PRIVATE_CONNECTION = "private_connection_value_sentinel";
const PRIVATE_ROLE = "private_database_role_sentinel";
const PRIVATE_ERROR = "private_driver_error_sentinel";
const CLOSED_ERROR = "Temporary preview role probe failed.";

interface PoolOptions {
  readonly rows?: readonly Record<string, unknown>[];
  readonly connectFailure?: boolean;
  readonly queryFailure?: boolean;
  readonly releaseFailure?: boolean;
  readonly closeFailure?: boolean;
}

/** Builds one retained-client pool without admitting a real database connection. */
function fakePool(options: PoolOptions = {}) {
  const queries: string[] = [];
  const release = vi.fn(() => {
    if (options.releaseFailure) {
      throw new Error(`${PRIVATE_CONNECTION} ${PRIVATE_ERROR}`);
    }
  });
  const end = vi.fn(async () => {
    if (options.closeFailure) {
      throw new Error(`${PRIVATE_CONNECTION} ${PRIVATE_ERROR}`);
    }
  });
  const client: TemporaryPreviewRoleProbeClientPort = {
    async query<Row extends Record<string, unknown>>(sql: string) {
      queries.push(sql);
      if (options.queryFailure) {
        throw new Error(
          `${PRIVATE_CONNECTION} ${PRIVATE_ROLE} ${PRIVATE_ERROR}`,
        );
      }
      return {
        rows: (options.rows ?? [{ role_ok: true }]) as readonly Row[],
      };
    },
    release,
  };
  const connect = vi.fn(async () => {
    if (options.connectFailure) {
      throw new Error(
        `${PRIVATE_CONNECTION} ${PRIVATE_ROLE} ${PRIVATE_ERROR}`,
      );
    }
    return client;
  });
  const pool: TemporaryPreviewRoleProbePoolPort = { connect, end };
  return { pool, queries, connect, release, end };
}

/** Captures only the fixed public error message used by the adapter contract. */
async function renderedFailure(
  pool: TemporaryPreviewRoleProbePoolPort,
): Promise<string> {
  try {
    await createPostgresTemporaryPreviewRoleProbeAdapter(pool).probeRole();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe("temporary preview role probe adapter", () => {
  it("uses one retained client and one exact read-only query", async () => {
    const fixture = fakePool();

    await expect(
      createPostgresTemporaryPreviewRoleProbeAdapter(
        fixture.pool,
      ).probeRole(),
    ).resolves.toBe(true);

    expect(fixture.connect).toHaveBeenCalledOnce();
    expect(fixture.queries).toEqual([ROLE_QUERY]);
    expect(fixture.release).toHaveBeenCalledOnce();
    expect(fixture.end).toHaveBeenCalledOnce();
  });

  it("returns true only for exactly one literal true row", async () => {
    const trueFixture = fakePool({ rows: [{ role_ok: true }] });
    const falseFixture = fakePool({ rows: [{ role_ok: false }] });

    await expect(
      createPostgresTemporaryPreviewRoleProbeAdapter(
        trueFixture.pool,
      ).probeRole(),
    ).resolves.toBe(true);
    await expect(
      createPostgresTemporaryPreviewRoleProbeAdapter(
        falseFixture.pool,
      ).probeRole(),
    ).resolves.toBe(false);
  });

  it.each([
    {
      label: "false",
      rows: [{ role_ok: false }],
    },
    {
      label: "zero rows",
      rows: [],
    },
    {
      label: "multiple rows",
      rows: [{ role_ok: true }, { role_ok: true }],
    },
    {
      label: "missing role_ok",
      rows: [{}],
    },
    {
      label: "nonboolean role_ok",
      rows: [{ role_ok: "true" }],
    },
  ])("fails closed for $label", async ({ rows }) => {
    const fixture = fakePool({ rows });

    await expect(
      createPostgresTemporaryPreviewRoleProbeAdapter(
        fixture.pool,
      ).probeRole(),
    ).resolves.toBe(false);
    expect(fixture.release).toHaveBeenCalledOnce();
    expect(fixture.end).toHaveBeenCalledOnce();
  });

  it("releases and closes when query fails", async () => {
    const fixture = fakePool({ queryFailure: true });

    await expect(renderedFailure(fixture.pool)).resolves.toBe(CLOSED_ERROR);
    expect(fixture.release).toHaveBeenCalledOnce();
    expect(fixture.end).toHaveBeenCalledOnce();
  });

  it("closes the pool when connect fails", async () => {
    const fixture = fakePool({ connectFailure: true });

    await expect(renderedFailure(fixture.pool)).resolves.toBe(CLOSED_ERROR);
    expect(fixture.release).not.toHaveBeenCalled();
    expect(fixture.end).toHaveBeenCalledOnce();
  });

  it.each([
    { label: "release", options: { releaseFailure: true } },
    { label: "close", options: { closeFailure: true } },
  ])("fails closed when $label fails", async ({ options }) => {
    const fixture = fakePool(options);

    await expect(renderedFailure(fixture.pool)).resolves.toBe(CLOSED_ERROR);
  });

  it("does not return private values or raw errors", async () => {
    for (const options of [
      { connectFailure: true },
      { queryFailure: true },
      { releaseFailure: true },
      { closeFailure: true },
    ] satisfies readonly PoolOptions[]) {
      const fixture = fakePool(options);
      const rendered = await renderedFailure(fixture.pool);
      expect(rendered).toBe(CLOSED_ERROR);
      for (const forbidden of [
        PRIVATE_CONNECTION,
        PRIVATE_ROLE,
        PRIVATE_ERROR,
      ]) {
        expect(rendered).not.toContain(forbidden);
      }
    }
  });
});
