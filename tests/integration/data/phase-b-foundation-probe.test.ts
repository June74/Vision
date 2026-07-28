import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseEncryptedBackup } from "../../../src/crypto/backup-envelope";
import { decodeBase64Url } from "../../../src/crypto/envelope";
import {
  createPhaseBFoundationProbeSource,
  PHASE_B_FOUNDATION_SENTINEL_MARKER,
  PhaseBFoundationProbeSourceError,
  type PhaseBFoundationProbeBucketPort,
  type PhaseBFoundationProbeClientPort,
  type PhaseBFoundationProbePoolPort,
} from "../../../src/data/phase-b-foundation-probe";
import { sha256Base64Url } from "../../../src/data/backup/export-backup";
import {
  type PhaseBPrivilegeManifest,
} from "../../../src/domain/operations/phase-b-privilege-manifest";
import { BACKUP_TABLES } from "../../../src/domain/backup/schema-contract";

const OBSERVED_AT = new Date("2026-07-28T20:00:00.000Z");
const OWNER_ID = "synthetic-owner";

function syntheticManifestForAdapterOnly(): PhaseBPrivilegeManifest {
  return {
    role: "vision_app",
    schema: "public",
    schemaOwner: "synthetic-schema-owner",
    schemaPrivileges: ["USAGE"],
    schemaGrantOptions: [],
    tables: BACKUP_TABLES.map((table) => ({
      table,
      owner: "synthetic-table-owner",
      privileges: [],
      grantOptions: [],
    })),
  };
}

function aggregateRow(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    role_matches: true,
    schema_mismatch_count: "0",
    privilege_mismatch_count: "0",
    public_grant_count: "0",
    identity_violations: "0",
    domain_violations: "0",
    privacy_violations: "0",
    provenance_violations: "0",
    reference_violations: "0",
    checkpoint_violations: "0",
    protected_storage_mismatch_count: "0",
    database_bytes: "12",
    ...overrides,
  };
}

async function validBackupObject() {
  const encrypted = parseEncryptedBackup(
    JSON.stringify({
      format: "vision-backup-envelope",
      version: 1,
      algorithm: "A256GCM",
      keyVersion: 1,
      iv: "A".repeat(16),
      ciphertext: "A".repeat(22),
    }),
  );
  const body = new TextEncoder().encode(JSON.stringify(encrypted));
  const bodySha256 = await sha256Base64Url(body);
  const ciphertextSha256 = await sha256Base64Url(
    decodeBase64Url(
      encrypted.ciphertext,
      "Synthetic backup ciphertext",
      encrypted.ciphertext.length,
    ),
  );
  const object = {
    key: "opaque-test-object",
    size: body.byteLength,
    bodySha256,
    customMetadata: {
      format: "vision-backup/v1",
      createdDate: "2026-07-28",
      ciphertextSha256,
      keyVersion: "1",
    },
  };
  return { body, object };
}

async function harness(options?: {
  readonly aggregate?: Readonly<Record<string, unknown>>;
  readonly sentinelRows?: readonly Readonly<Record<string, unknown>>[];
  readonly decryptControlledTitle?: (
    candidate: Readonly<Record<string, unknown>>,
  ) => Promise<Uint8Array>;
  readonly list?: PhaseBFoundationProbeBucketPort["list"];
  readonly get?: PhaseBFoundationProbeBucketPort["get"];
}) {
  const backup = await validBackupObject();
  const query = vi.fn(
    async (statement: string, _parameters: readonly unknown[]) => {
      if (statement.includes("phase_b_foundation_aggregates")) {
        return { rows: [options?.aggregate ?? aggregateRow()] };
      }
      if (statement.includes("phase_b_foundation_sentinel")) {
        return { rows: options?.sentinelRows ?? [] };
      }
      throw new Error("unexpected synthetic query");
    },
  );
  const release = vi.fn();
  const client: PhaseBFoundationProbeClientPort = {
    async query<Row extends Record<string, unknown>>(
      statement: string,
      parameters: readonly unknown[],
    ) {
      const result = await query(statement, parameters);
      return { rows: result.rows as readonly Row[] };
    },
    release,
  };
  const connect = vi.fn(async () => client);
  const end = vi.fn(async () => undefined);
  const pool: PhaseBFoundationProbePoolPort = { connect, end };
  const list = vi.fn<PhaseBFoundationProbeBucketPort["list"]>(
    options?.list ??
      (async () => ({
        objects: [backup.object],
        truncated: false,
      })),
  );
  const get = vi.fn<PhaseBFoundationProbeBucketPort["get"]>(
    options?.get ??
      (async () => ({
        ...backup.object,
        body: backup.body,
      })),
  );
  const bucket: PhaseBFoundationProbeBucketPort = { list, get };
  const decryptControlledTitle = vi.fn(
    options?.decryptControlledTitle ??
      (async () =>
        new TextEncoder().encode(PHASE_B_FOUNDATION_SENTINEL_MARKER)),
  );

  return {
    bucket,
    client,
    connect,
    decryptControlledTitle,
    end,
    get,
    list,
    pool,
    query,
    release,
    source: createPhaseBFoundationProbeSource({
      pool,
      bucket,
      privilegeManifest: syntheticManifestForAdapterOnly(),
      ownerId: OWNER_ID,
      decryptControlledTitle,
    }),
  };
}

describe("Phase B foundation probe source", () => {
  it("rejects an unattested privilege manifest before database or R2 access", () => {
    const connect = vi.fn();
    const list = vi.fn();

    expect(() =>
      createPhaseBFoundationProbeSource({
        pool: { connect, end: vi.fn() },
        bucket: { list, get: vi.fn() },
        privilegeManifest: undefined,
        ownerId: OWNER_ID,
        decryptControlledTitle: vi.fn(),
      }),
    ).toThrow("Phase B foundation probe configuration is invalid.");
    expect(connect).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it("rejects a manifest for any schema other than the fixed application schema before I/O", () => {
    const connect = vi.fn();
    const list = vi.fn();

    expect(() =>
      createPhaseBFoundationProbeSource({
        pool: { connect, end: vi.fn() },
        bucket: { list, get: vi.fn() },
        privilegeManifest: {
          ...syntheticManifestForAdapterOnly(),
          schema: "search_path_shadow",
        },
        ownerId: OWNER_ID,
        decryptControlledTitle: vi.fn(),
      }),
    ).toThrow("Phase B foundation probe configuration is invalid.");
    expect(connect).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it("returns only admitted aggregates through one retained client and bounded R2 reads", async () => {
    const run = await harness();
    const expectedR2Bytes = (await validBackupObject()).object.size;

    const result = await run.source.read(OBSERVED_AT);

    expect(result).toEqual({
      roleMatches: true,
      schemaMatches: true,
      privilegesMatch: true,
      publicGrantCount: 0,
      identityViolations: 0,
      domainViolations: 0,
      privacyViolations: 0,
      provenanceViolations: 0,
      referenceViolations: 0,
      checkpointViolations: 0,
      protectedStorageMatches: true,
      sentinelStatus: "not_tested",
      backupContractMatches: true,
      databaseBytes: 12,
      r2ObjectCount: 1,
      r2Bytes: expectedR2Bytes,
    });
    expect(run.connect).toHaveBeenCalledOnce();
    expect(run.release).toHaveBeenCalledOnce();
    expect(run.end).toHaveBeenCalledOnce();
    expect(run.list).toHaveBeenCalledWith({
      prefix: "backups/v1/",
      limit: 100,
    });
    expect(run.get).toHaveBeenCalledOnce();
  });

  it("uses only parameterized read-only SQL without locks or provider capability", async () => {
    const run = await harness();

    await run.source.read(OBSERVED_AT);

    expect(run.query).toHaveBeenCalledTimes(2);
    for (const [statement, parameters] of run.query.mock.calls) {
      expect(statement).toContain("$1");
      expect(parameters.length).toBeGreaterThan(0);
      const grammarOnly = statement
        .toLowerCase()
        .replace(/'(?:[^']|'')*'/gu, "''");
      expect(grammarOnly).not.toMatch(
        /\b(?:insert|update|delete|alter|drop|create|truncate|merge|call|copy|lock)\b/u,
      );
      expect(statement.toLowerCase()).not.toContain("for update");
    }
    const aggregateCall = run.query.mock.calls[0]!;
    expect(aggregateCall[0]).toContain("to_regclass");
    expect(aggregateCall[0]).toContain("to_regnamespace");
    expect(aggregateCall[0]).toContain(
      "event.provider_calendar_id = ''",
    );
    expect(aggregateCall[0]).toContain("event.provider_event_id = ''");
    expect(aggregateCall[0]).toContain("event.provider_version = ''");
    const sentinelCall = run.query.mock.calls[1]!;
    expect(sentinelCall[0]).toContain(
      "event.provider = 'google-calendar'",
    );
    expect(sentinelCall[1]).toEqual([
      OWNER_ID,
      new Date("2026-07-28T19:45:00.000Z"),
      new Date("2026-07-28T20:01:00.000Z"),
    ]);
    for (const [relation, aggregateUses, sentinelUses] of [
      ["nodes", 7, 1],
      ["edges", 2, 0],
      ["events", 1, 1],
      ["sync_checkpoints", 1, 0],
    ] as const) {
      expect(
        aggregateCall[0].match(
          new RegExp(`\\bpublic\\.${relation}\\b`, "gu"),
        ),
      ).toHaveLength(aggregateUses);
      expect(
        sentinelCall[0].match(
          new RegExp(`\\bpublic\\.${relation}\\b`, "gu"),
        ) ?? [],
      ).toHaveLength(sentinelUses);
      expect(
        `${aggregateCall[0]}\n${sentinelCall[0]}`,
      ).not.toMatch(
        new RegExp(
          `\\b(?:from|join)\\s+(?!public\\.)${relation}\\b`,
          "iu",
        ),
      );
    }
  });

  it("passes every schema, owner, privilege, and grant expectation to the aggregate query", async () => {
    const run = await harness();
    const expectedManifest = syntheticManifestForAdapterOnly();

    await run.source.read(OBSERVED_AT);

    const aggregateCall = run.query.mock.calls[0]!;
    const privilegeParameter = JSON.parse(
      aggregateCall[1][2] as string,
    ) as unknown;
    expect(privilegeParameter).toEqual({
      schema_owner: expectedManifest.schemaOwner,
      schema_privileges: expectedManifest.schemaPrivileges,
      schema_grant_options: expectedManifest.schemaGrantOptions,
      tables: expectedManifest.tables.map((table) => ({
        table_name: table.table,
        owner_name: table.owner,
        privileges: table.privileges,
        grant_options: table.grantOptions,
      })),
    });
  });

  it.each([
    ["zero candidates", []],
    [
      "multiple candidates",
      [
        {
          node_id: "one",
          owner_id: OWNER_ID,
          domain: "personal",
          title_envelope: new Uint8Array([1]),
        },
        {
          node_id: "two",
          owner_id: OWNER_ID,
          domain: "personal",
          title_envelope: new Uint8Array([2]),
        },
      ],
    ],
    [
      "missing title",
      [
        {
          node_id: "one",
          owner_id: OWNER_ID,
          domain: "personal",
          title_envelope: null,
        },
      ],
    ],
  ])("returns not_tested for %s without decrypting", async (_, rows) => {
    const run = await harness({ sentinelRows: rows });

    const result = await run.source.read(OBSERVED_AT);

    expect(result.sentinelStatus).toBe("not_tested");
    expect(run.decryptControlledTitle).not.toHaveBeenCalled();
  });

  it("keeps protected storage matched when raw title bytes omit the marker and clears plaintext", async () => {
    const plaintext = new TextEncoder().encode(
      PHASE_B_FOUNDATION_SENTINEL_MARKER,
    );
    const run = await harness({
      sentinelRows: [
        {
          node_id: "one",
          owner_id: OWNER_ID,
          domain: "personal",
          title_envelope: new Uint8Array([1]),
        },
      ],
      decryptControlledTitle: async () => plaintext,
    });

    const result = await run.source.read(OBSERVED_AT);

    expect(result.sentinelStatus).toBe("passed");
    expect(result.protectedStorageMatches).toBe(true);
    expect(run.decryptControlledTitle).toHaveBeenCalledOnce();
    expect([...plaintext].every((value) => value === 0)).toBe(true);
  });

  it("fails protected storage when raw title bytes contain the marker and still clears plaintext", async () => {
    const marker = new TextEncoder().encode(
      PHASE_B_FOUNDATION_SENTINEL_MARKER,
    );
    const titleEnvelope = new Uint8Array(marker.byteLength + 2);
    titleEnvelope.set(marker, 1);
    const plaintext = new TextEncoder().encode(
      PHASE_B_FOUNDATION_SENTINEL_MARKER,
    );
    const run = await harness({
      sentinelRows: [
        {
          node_id: "one",
          owner_id: OWNER_ID,
          domain: "personal",
          title_envelope: titleEnvelope,
        },
      ],
      decryptControlledTitle: async () => plaintext,
    });

    const result = await run.source.read(OBSERVED_AT);

    expect(result.sentinelStatus).toBe("passed");
    expect(result.protectedStorageMatches).toBe(false);
    expect(run.decryptControlledTitle).toHaveBeenCalledOnce();
    expect([...plaintext].every((value) => value === 0)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(
      PHASE_B_FOUNDATION_SENTINEL_MARKER,
    );
  });

  it("clears controlled plaintext when comparison fails", async () => {
    const plaintext = new TextEncoder().encode("different");
    const run = await harness({
      sentinelRows: [
        {
          node_id: "one",
          owner_id: OWNER_ID,
          domain: "personal",
          title_envelope: new Uint8Array([1]),
        },
      ],
      decryptControlledTitle: async () => plaintext,
    });

    const result = await run.source.read(OBSERVED_AT);

    expect(result.sentinelStatus).toBe("failed");
    expect([...plaintext].every((value) => value === 0)).toBe(true);
  });

  it.each([
    ["negative", "-1"],
    ["fractional", 1.5],
    ["unsafe", Number.MAX_SAFE_INTEGER + 1],
    ["alternate decimal", "01"],
  ])("rejects %s database integers with a closed numeric category", async (_, value) => {
    const run = await harness({
      aggregate: aggregateRow({ identity_violations: value }),
    });

    await expect(run.source.read(OBSERVED_AT)).rejects.toMatchObject({
      category: "numeric_bound_exceeded",
    });
  });

  it("releases the sole client and closes the pool when database work fails", async () => {
    const run = await harness();
    run.query.mockRejectedValueOnce(new Error("private database detail"));

    await expect(run.source.read(OBSERVED_AT)).rejects.toMatchObject({
      category: "database_unavailable",
    });
    expect(run.connect).toHaveBeenCalledOnce();
    expect(run.release).toHaveBeenCalledOnce();
    expect(run.end).toHaveBeenCalledOnce();
    expect(run.list).not.toHaveBeenCalled();
  });

  it("closes the pool when client acquisition fails", async () => {
    const run = await harness();
    run.connect.mockRejectedValueOnce(new Error("private database detail"));

    await expect(run.source.read(OBSERVED_AT)).rejects.toMatchObject({
      category: "database_unavailable",
    });
    expect(run.release).not.toHaveBeenCalled();
    expect(run.end).toHaveBeenCalledOnce();
    expect(run.list).not.toHaveBeenCalled();
  });

  it("maps R2 failure to a closed category after database cleanup", async () => {
    const run = await harness({
      list: async () => {
        throw new Error("private R2 detail");
      },
    });

    await expect(run.source.read(OBSERVED_AT)).rejects.toMatchObject({
      category: "r2_unavailable",
    });
    expect(run.release).toHaveBeenCalledOnce();
    expect(run.end).toHaveBeenCalledOnce();
  });

  it("bounds R2 listing at 100 pages and 10,000 objects", async () => {
    let page = 0;
    const run = await harness({
      list: async () => ({
        objects: Array.from({ length: 100 }, (_, index) => ({
          key: `opaque-${page}-${index}`,
          size: 0,
          customMetadata: {},
        })),
        truncated: true,
        cursor: `opaque-cursor-${++page}`,
      }),
    });

    await expect(run.source.read(OBSERVED_AT)).rejects.toMatchObject({
      category: "r2_unavailable",
    });
    expect(run.list).toHaveBeenCalledTimes(100);
  });

  it("rejects repeated cursors and unsafe R2 byte aggregation", async () => {
    const repeated = await harness({
      list: async () => ({
        objects: [],
        truncated: true,
        cursor: "repeated",
      }),
    });
    await expect(repeated.source.read(OBSERVED_AT)).rejects.toMatchObject({
      category: "r2_unavailable",
    });
    expect(repeated.list).toHaveBeenCalledTimes(2);

    const overflowing = await harness({
      list: async () => ({
        objects: [
          { key: "one", size: Number.MAX_SAFE_INTEGER, customMetadata: {} },
          { key: "two", size: 1, customMetadata: {} },
        ],
        truncated: false,
      }),
    });
    await expect(overflowing.source.read(OBSERVED_AT)).rejects.toMatchObject({
      category: "numeric_bound_exceeded",
    });
  });

  it.each([
    ["wrong date", { createdDate: "2026-07-27" }],
    ["unsupported format", { format: "other" }],
    ["unsupported key version", { keyVersion: "2" }],
    ["invalid digest", { ciphertextSha256: "invalid" }],
    ["extra metadata", { extra: "forbidden" }],
  ])("reports backup contract mismatch for %s", async (_, metadataOverride) => {
    const backup = await validBackupObject();
    const changed = {
      ...backup.object,
      customMetadata: {
        ...backup.object.customMetadata,
        ...metadataOverride,
      },
    };
    const run = await harness({
      list: async () => ({ objects: [changed], truncated: false }),
      get: async () => ({ ...changed, body: backup.body }),
    });

    const result = await run.source.read(OBSERVED_AT);

    expect(result.backupContractMatches).toBe(false);
  });

  it("uses parseEncryptedBackup bounds and never reads the backup key or mutates R2", async () => {
    const source = await readFile(
      resolve(process.cwd(), "src", "data", "phase-b-foundation-probe.ts"),
      "utf8",
    );

    expect(source).toContain("parseEncryptedBackup");
    expect(source).not.toContain("BACKUP_ENCRYPTION_KEY");
    expect(source).not.toMatch(/\.put\s*\(/u);
    expect(source).not.toMatch(/\.delete\s*\(/u);
    expect(source).not.toContain("fetch(");
    expect(PhaseBFoundationProbeSourceError).toBeTypeOf("function");
  });
});
