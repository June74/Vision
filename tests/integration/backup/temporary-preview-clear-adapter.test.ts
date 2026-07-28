import { describe, expect, it, vi } from "vitest";
import {
  createPostgresTemporaryPreviewClearAdapter,
  type TemporaryPreviewClearClientPort,
  type TemporaryPreviewClearPoolPort,
} from "../../../src/data/backup/temporary-preview-clear-adapter";
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  type BackupRowCounts,
  type BackupTableName,
} from "../../../src/domain/backup/manifest";
import { BACKUP_SCHEMA_MIGRATION_SHA256 } from "../../../src/domain/backup/schema-contract";

const PRIVATE_TARGET = "private_disposable_target_sentinel";
const PRIVATE_DATABASE = "private_database_value_sentinel";
const PRIVATE_REVISION = "private_revision_sentinel";
const PRIVATE_RAW_ERROR = "private_raw_driver_error_sentinel";

interface FakeClientOptions {
  readonly currentUser?: string;
  readonly attestationRows?: readonly Record<string, unknown>[];
  readonly counts?: BackupRowCounts;
  readonly failWhen?: (sql: string) => boolean;
  readonly preserveAfterDelete?: BackupTableName;
}

function expectedCounts(): BackupRowCounts {
  const counts = Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, 0]),
  ) as Record<BackupTableName, number>;
  const nonempty = BACKUP_TABLES.filter((table) => table !== "events").slice(
    0,
    13,
  );
  for (const table of nonempty) counts[table] = 1;
  counts[nonempty[0]!] = 39;
  return Object.freeze(counts);
}

function attestation(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    environment: "preview",
    target_id: PRIVATE_TARGET,
    disposable: true,
    schema_version: BACKUP_SCHEMA_VERSION,
    migration_sha256: BACKUP_SCHEMA_MIGRATION_SHA256,
    attestation_revision: PRIVATE_REVISION,
    ...overrides,
  };
}

function fakePool(options: FakeClientOptions = {}) {
  const queries: string[] = [];
  const release = vi.fn();
  const end = vi.fn(async () => undefined);
  const counts = {
    ...(options.counts ?? expectedCounts()),
  } as Record<BackupTableName, number>;
  let attestationRead = 0;
  const client: TemporaryPreviewClearClientPort = {
    async query<Row extends Record<string, unknown>>(sql: string) {
      const normalized = sql.replace(/\s+/gu, " ").trim();
      queries.push(normalized);
      if (options.failWhen?.(normalized)) {
        throw new Error(
          `${PRIVATE_DATABASE} ${PRIVATE_TARGET} ${PRIVATE_RAW_ERROR}`,
        );
      }
      if (normalized === 'select current_user as "current_user"') {
        return {
          rows: [
            {
              current_user: options.currentUser ?? "vision_app",
            } as unknown as Row,
          ],
        };
      }
      if (
        normalized.includes(
          'from "public"."vision_restore_target_attestation"',
        )
      ) {
        const rows = options.attestationRows ?? [attestation()];
        const row = rows[Math.min(attestationRead, rows.length - 1)];
        attestationRead += 1;
        return { rows: row ? [row as Row] : [] };
      }
      if (normalized.startsWith("select (select count(*)")) {
        return { rows: [{ ...counts } as unknown as Row] };
      }
      const deleteMatch = normalized.match(
        /^delete from "public"\."([a-z0-9_]+)"$/u,
      );
      if (deleteMatch) {
        const table = deleteMatch[1] as BackupTableName;
        if (table !== options.preserveAfterDelete) counts[table] = 0;
      }
      return { rows: [] };
    },
    release,
  };
  const connect = vi.fn(async () => client);
  const pool: TemporaryPreviewClearPoolPort = { connect, end };
  return { pool, queries, release, end, connect };
}

function safeRendered(value: unknown): string {
  return value instanceof Error ? value.message : JSON.stringify(value);
}

describe("temporary preview clear adapter", () => {
  it("uses one retained serializable session and the exact canonical fenced clear order", async () => {
    const fixture = fakePool();
    const adapter = createPostgresTemporaryPreviewClearAdapter(
      fixture.pool,
      {
        environment: "preview",
        targetId: PRIVATE_TARGET,
        disposable: true,
      },
    );

    const result = await adapter.clear(expectedCounts());

    expect(result).toEqual({
      cleared: true,
      authoritativeTableCount: 29,
      totalRows: 0,
      nonemptyTables: 0,
      eventRows: 0,
    });
    expect(Object.keys(result)).not.toContain("targetId");
    expect(fixture.connect).toHaveBeenCalledOnce();
    expect(fixture.queries[0]).toBe("begin isolation level serializable");
    expect(fixture.queries[1]).toBe('select current_user as "current_user"');
    expect(fixture.queries[2]).toContain(
      'from "public"."vision_restore_target_attestation" for update',
    );
    expect(fixture.queries.slice(3, 3 + BACKUP_TABLES.length)).toEqual(
      BACKUP_TABLES.map(
        (table) =>
          `lock table "public"."${table}" in access exclusive mode`,
      ),
    );
    expect(fixture.queries[32]).toContain(
      'from "public"."vision_restore_target_attestation"',
    );
    expect(fixture.queries[32]).not.toContain("for update");
    expect(fixture.queries[33]).toContain("select (select count(*)");
    expect(
      fixture.queries.slice(34, 34 + BACKUP_TABLES.length),
    ).toEqual(
      [...BACKUP_TABLES].reverse().map(
        (table) => `delete from "public"."${table}"`,
      ),
    );
    expect(fixture.queries[63]).toContain("select (select count(*)");
    expect(fixture.queries[64]).toContain(
      'from "public"."vision_restore_target_attestation"',
    );
    expect(fixture.queries[65]).toBe("commit");
    expect(fixture.release).toHaveBeenCalledOnce();
    expect(fixture.end).toHaveBeenCalledOnce();
  });

  it.each([
    {
      label: "wrong role",
      options: { currentUser: "postgres" } satisfies FakeClientOptions,
    },
    {
      label: "wrong attestation",
      options: {
        attestationRows: [attestation({ target_id: "other-target" })],
      } satisfies FakeClientOptions,
    },
    {
      label: "prepared count mismatch",
      options: {
        counts: Object.freeze({
          ...expectedCounts(),
          audit_events: expectedCounts().audit_events + 1,
        }),
      } satisfies FakeClientOptions,
    },
    {
      label: "lock failure",
      options: {
        failWhen: (sql: string) =>
          sql ===
          `lock table "public"."${BACKUP_TABLES[4]}" in access exclusive mode`,
      } satisfies FakeClientOptions,
    },
    {
      label: "delete failure",
      options: {
        failWhen: (sql: string) =>
          sql ===
          `delete from "public"."${[...BACKUP_TABLES].reverse()[4]}"`,
      } satisfies FakeClientOptions,
    },
    {
      label: "post-clear count failure",
      options: {
        preserveAfterDelete: BACKUP_TABLES[0],
      } satisfies FakeClientOptions,
    },
    {
      label: "commit failure",
      options: {
        failWhen: (sql: string) => sql === "commit",
      } satisfies FakeClientOptions,
    },
  ])("rolls back and closes on $label without returning private values", async ({
    options,
  }) => {
    const fixture = fakePool(options);
    const adapter = createPostgresTemporaryPreviewClearAdapter(
      fixture.pool,
      {
        environment: "preview",
        targetId: PRIVATE_TARGET,
        disposable: true,
      },
    );

    let rendered = "";
    try {
      await adapter.clear(expectedCounts());
    } catch (error) {
      rendered = safeRendered(error);
    }

    expect(rendered).toBe("Temporary preview target clear failed.");
    expect(fixture.queries).toContain("rollback");
    expect(fixture.release).toHaveBeenCalledOnce();
    expect(fixture.end).toHaveBeenCalledOnce();
    for (const forbidden of [
      PRIVATE_TARGET,
      PRIVATE_DATABASE,
      PRIVATE_REVISION,
      PRIVATE_RAW_ERROR,
    ]) {
      expect(rendered).not.toContain(forbidden);
    }
  });

  it("rejects a safe aggregate with nonzero events even when every prepared count matches", async () => {
    const counts = { ...expectedCounts() };
    const firstNonEvent = BACKUP_TABLES.find(
      (table) => table !== "events" && counts[table] > 0,
    )!;
    counts[firstNonEvent] -= 1;
    counts.events = 1;
    const fixture = fakePool({ counts });
    const adapter = createPostgresTemporaryPreviewClearAdapter(
      fixture.pool,
      {
        environment: "preview",
        targetId: PRIVATE_TARGET,
        disposable: true,
      },
    );

    await expect(adapter.clear(counts)).rejects.toThrow(
      "Temporary preview target clear failed.",
    );
    expect(fixture.queries).toContain("rollback");
    expect(
      fixture.queries.some((sql) => sql.startsWith("delete from ")),
    ).toBe(false);
    expect(fixture.release).toHaveBeenCalledOnce();
    expect(fixture.end).toHaveBeenCalledOnce();
  });

  it.each([1, 2])(
    "rejects attestation drift at protected reread %s",
    async (reread) => {
      const rows =
        reread === 1
          ? [
              attestation(),
              attestation({ attestation_revision: "changed-before-clear" }),
            ]
          : [
              attestation(),
              attestation(),
              attestation({ attestation_revision: "changed-after-clear" }),
            ];
      const fixture = fakePool({ attestationRows: rows });
      const adapter = createPostgresTemporaryPreviewClearAdapter(
        fixture.pool,
        {
          environment: "preview",
          targetId: PRIVATE_TARGET,
          disposable: true,
        },
      );

      await expect(adapter.clear(expectedCounts())).rejects.toThrow(
        "Temporary preview target clear failed.",
      );
      expect(fixture.queries).toContain("rollback");
      expect(fixture.release).toHaveBeenCalledOnce();
      expect(fixture.end).toHaveBeenCalledOnce();
    },
  );

  it("closes the pool when connecting fails before a client exists", async () => {
    const end = vi.fn(async () => undefined);
    const pool: TemporaryPreviewClearPoolPort = {
      async connect() {
        throw new Error(PRIVATE_RAW_ERROR);
      },
      end,
    };
    const adapter = createPostgresTemporaryPreviewClearAdapter(pool, {
      environment: "preview",
      targetId: PRIVATE_TARGET,
      disposable: true,
    });

    await expect(adapter.clear(expectedCounts())).rejects.toThrow(
      "Temporary preview target clear failed.",
    );
    expect(end).toHaveBeenCalledOnce();
  });
});
