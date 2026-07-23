import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { VisionDatabase } from "../../../src/data/db";
import {
  CalendarRepository,
  DrizzleCalendarStore,
  type VerifiedCalendarEvidence,
} from "../../../src/data/repositories/calendar-repository";

const dialect = new PgDialect();
const OWNER = "usr_private_pilot";
const SUBJECT = "google-subject";
const NOW = new Date("2026-07-23T19:00:00.000Z");
const OPERATION = "11111111-1111-4111-8111-111111111111";

let pglite: PGlite;
let repository: CalendarRepository;

function database(): VisionDatabase {
  return {
    execute: async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement);
      const result = await pglite.query(query.sql, query.params as never[]);
      return { rows: result.rows };
    },
  } as unknown as VisionDatabase;
}

function evidence(id: string): VerifiedCalendarEvidence {
  return {
    id,
    summary: "Vision",
    accessRole: "owner",
    timeZone: "America/Chicago",
    providerEtag: `"${id}"`,
    ownerGoogleSubject: SUBJECT,
    verifiedAt: NOW,
  };
}

beforeEach(async () => {
  pglite = new PGlite();
  for (const migration of [
    "0001_phase_b_foundation.sql",
    "0002_google_auth_sessions.sql",
    "0003_calendar_setup.sql",
  ]) {
    await pglite.exec(
      await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
    );
  }
  repository = new CalendarRepository(
    new DrizzleCalendarStore(database()),
    OWNER,
    SUBJECT,
  );
});

afterEach(async () => {
  await pglite.close();
});

describe("calendar setup persistence", () => {
  it("uses current-version CAS and normalized candidate rows for explicit selection", async () => {
    await expect(repository.getOrCreateAuthenticated(NOW)).resolves.toMatchObject({
      status: "authenticated",
      setupVersion: 1,
    });
    await expect(repository.beginDiscovery(1, NOW)).resolves.toMatchObject({
      status: "discovering",
      setupVersion: 2,
    });
    await expect(
      repository.completeDiscovery(2, [evidence("vision-a")], NOW),
    ).resolves.toMatchObject({
      status: "awaiting_choice",
      setupVersion: 3,
      candidates: [{ id: "vision-a" }],
    });

    await expect(
      repository.selectExisting(2, evidence("vision-a"), NOW),
    ).rejects.toMatchObject({ code: "STALE_SETUP_VERSION" });
    await expect(
      repository.selectExisting(3, evidence("vision-a"), NOW),
    ).resolves.toMatchObject({
      status: "connected",
      setupVersion: 4,
      connection: { calendarId: "vision-a", connectionKind: "existing" },
    });

    const raw = await pglite.query<Record<string, unknown>>(
      "select * from vision_calendar_connections where owner_id = $1",
      [OWNER],
    );
    expect(raw.rows[0]).toMatchObject({
      owner_id: OWNER,
      google_subject: SUBJECT,
      provider_calendar_id: "vision-a",
      ownership_access_role: "owner",
      time_zone: "America/Chicago",
      provider_etag: '"vision-a"',
    });
  });

  it("linearizes concurrent create starts to one operation and one pre-create snapshot", async () => {
    await repository.getOrCreateAuthenticated(NOW);
    await repository.beginDiscovery(1, NOW);
    await repository.completeDiscovery(2, [], NOW);

    const [first, second] = await Promise.all([
      repository.beginCreation(3, OPERATION, [evidence("pre-existing")], NOW),
      repository.beginCreation(3, OPERATION, [evidence("pre-existing")], NOW),
    ]);

    expect([first.kind, second.kind].sort()).toEqual(["existing", "started"]);
    const ledger = await pglite.query<Record<string, unknown>>(
      "select * from operation_ledger where operation_id = $1",
      [OPERATION],
    );
    const snapshot = await pglite.query<Record<string, unknown>>(
      "select * from calendar_create_snapshots where operation_id = $1",
      [OPERATION],
    );
    expect(ledger.rows).toHaveLength(1);
    expect(ledger.rows[0]).toMatchObject({
      owner_id: OWNER,
      provider: "google",
      provider_operation_id: OPERATION,
      operation_kind: "vision_calendar_create",
      status: "in_progress",
    });
    expect(snapshot.rows).toEqual([
      expect.objectContaining({
        owner_id: OWNER,
        provider_calendar_id: "pre-existing",
      }),
    ]);
  });

  it("completes one create idempotently and never exposes another owner's operation", async () => {
    await repository.getOrCreateAuthenticated(NOW);
    await repository.beginDiscovery(1, NOW);
    await repository.completeDiscovery(2, [], NOW);
    await repository.beginCreation(3, OPERATION, [], NOW);

    await expect(
      repository.completeCreation(OPERATION, evidence("created-vision"), NOW),
    ).resolves.toMatchObject({
      status: "connected",
      connection: {
        calendarId: "created-vision",
        connectionKind: "created",
      },
    });
    await expect(
      repository.completeCreation(OPERATION, evidence("created-vision"), NOW),
    ).resolves.toMatchObject({
      status: "connected",
      connection: { calendarId: "created-vision" },
    });

    const other = new CalendarRepository(
      new DrizzleCalendarStore(database()),
      "usr_other",
      SUBJECT,
    );
    await expect(other.findCreationOperation(OPERATION)).resolves.toBeUndefined();
  });

  it("stores stable evidence only and no token, provider body, or event payload columns", async () => {
    await repository.getOrCreateAuthenticated(NOW);
    await repository.beginDiscovery(1, NOW);
    await repository.completeDiscovery(2, [], NOW);
    await repository.beginCreation(3, OPERATION, [], NOW);
    await repository.markCreationUncertain(OPERATION, "retryable", NOW);

    const rows = await pglite.query<Record<string, unknown>>(
      `select
         s.owner_id, s.google_subject, s.setup_version,
         s.status as setup_status, s.action_required,
         o.operation_id, o.provider, o.provider_operation_id,
         o.operation_kind, o.status as operation_status, o.requested_at,
         o.completed_at, o.setup_version as operation_setup_version,
         o.result_calendar_id,
         coalesce(sn.provider_calendar_id, '') as snapshot_id
       from calendar_setup_states s
       join operation_ledger o on o.owner_id = s.owner_id
       left join calendar_create_snapshots sn on sn.operation_id = o.operation_id
       where s.owner_id = $1`,
      [OWNER],
    );
    const serialized = JSON.stringify(rows.rows);
    expect(serialized).not.toContain("ACCESS_TOKEN_SENTINEL");
    expect(serialized).not.toContain("events");
    expect(serialized).not.toContain("response_envelope");
    expect(rows.rows[0]).toMatchObject({
      setup_status: "failed",
      operation_status: "retryable",
      action_required: false,
    });
  });
});
