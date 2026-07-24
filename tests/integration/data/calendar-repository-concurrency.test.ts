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
const SECOND_OPERATION = "22222222-2222-4222-8222-222222222222";

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
    await expect(
      repository.discover(1, [evidence("vision-a")], NOW),
    ).resolves.toMatchObject({
      status: "awaiting_choice",
      setupVersion: 2,
      candidates: [{ id: "vision-a" }],
    });

    await expect(
      repository.selectExisting(1, evidence("vision-a"), NOW),
    ).rejects.toMatchObject({ code: "STALE_SETUP_VERSION" });
    await expect(
      repository.selectExisting(2, evidence("vision-a"), NOW),
    ).resolves.toMatchObject({
      status: "connected",
      setupVersion: 3,
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
    await repository.discover(1, [], NOW);

    const [first, second] = await Promise.all([
      repository.beginCreation(2, OPERATION, [evidence("pre-existing")], NOW),
      repository.beginCreation(2, OPERATION, [evidence("pre-existing")], NOW),
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
    await repository.discover(1, [], NOW);
    await repository.beginCreation(2, OPERATION, [], NOW);

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
    await repository.discover(1, [], NOW);
    await repository.beginCreation(2, OPERATION, [], NOW);
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

  it("atomically accepts one concurrent discovery result and returns it to the stale loser", async () => {
    const competing = new CalendarRepository(
      new DrizzleCalendarStore(database()),
      OWNER,
      SUBJECT,
    );

    const [first, second] = await Promise.all([
      repository.discover(1, [evidence("candidate-a")], NOW),
      competing.discover(1, [evidence("candidate-b")], NOW),
    ]);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      status: "awaiting_choice",
      setupVersion: 2,
    });
    expect(first.candidates).toHaveLength(1);
    expect(["candidate-a", "candidate-b"]).toContain(first.candidates[0]?.id);
    const raw = await pglite.query<Record<string, unknown>>(
      "select status, setup_version from calendar_setup_states where owner_id = $1",
      [OWNER],
    );
    expect(raw.rows).toEqual([
      { status: "awaiting_choice", setup_version: 2 },
    ]);
  });

  it("atomically terminalizes a definite rejection and releases the unresolved claim for a fresh key", async () => {
    await repository.discover(1, [], NOW);
    await repository.beginCreation(2, OPERATION, [], NOW);

    await expect(
      repository.markCreationDefiniteFailure(OPERATION, NOW),
    ).resolves.toMatchObject({
      status: "failed",
      setupVersion: 4,
      actionRequired: true,
    });
    await expect(repository.findCreationOperation(OPERATION)).resolves.toMatchObject({
      status: "definite_failure",
    });

    await expect(repository.discover(4, [], NOW)).resolves.toMatchObject({
      status: "awaiting_confirmation",
      setupVersion: 5,
    });
    await expect(
      repository.beginCreation(5, SECOND_OPERATION, [], NOW),
    ).resolves.toMatchObject({ kind: "started" });
    const unresolved = await pglite.query<{ operation_id: string }>(
      `select operation_id
       from operation_ledger
       where owner_id = $1
         and operation_kind = 'vision_calendar_create'
         and status in ('in_progress', 'retryable', 'action_required')`,
      [OWNER],
    );
    expect(unresolved.rows).toEqual([{ operation_id: SECOND_OPERATION }]);
  });

  it("keeps a retryable uncertain operation reconciliation-only and blocks a fresh create path", async () => {
    await repository.discover(1, [], NOW);
    await repository.beginCreation(2, OPERATION, [], NOW);
    const failed = await repository.markCreationUncertain(
      OPERATION,
      "retryable",
      NOW,
    );

    await expect(
      repository.discover(failed.setupVersion, [], NOW),
    ).resolves.toEqual(failed);
    await expect(
      repository.beginCreation(
        failed.setupVersion,
        SECOND_OPERATION,
        [],
        NOW,
      ),
    ).rejects.toMatchObject({ code: "STALE_SETUP_VERSION" });
    await expect(repository.findCreationOperation(OPERATION)).resolves.toMatchObject({
      status: "retryable",
    });
  });

  it("terminalizes a definite response after an uncertain crash marker and releases its claim", async () => {
    await repository.discover(1, [], NOW);
    await repository.beginCreation(2, OPERATION, [], NOW);
    await expect(
      repository.takeOverStaleCreation(
        OPERATION,
        new Date(NOW.getTime() + 1),
        new Date(NOW.getTime() + 120_001),
      ),
    ).resolves.toMatchObject({
      status: "retryable",
    });
    await expect(repository.getSnapshot()).resolves.toMatchObject({
      status: "failed",
      setupVersion: 4,
      actionRequired: false,
    });

    await expect(
      repository.markCreationDefiniteFailure(OPERATION, NOW),
    ).resolves.toMatchObject({
      status: "failed",
      setupVersion: 5,
      actionRequired: true,
    });
    await expect(repository.findCreationOperation(OPERATION)).resolves.toMatchObject({
      status: "definite_failure",
    });
    await expect(repository.discover(5, [], NOW)).resolves.toMatchObject({
      status: "awaiting_confirmation",
      setupVersion: 6,
    });
    await expect(
      repository.beginCreation(6, SECOND_OPERATION, [], NOW),
    ).resolves.toMatchObject({ kind: "started" });
  });

  it("keeps a within-lease owner replay active without changing setup", async () => {
    await repository.discover(1, [], NOW);
    await repository.beginCreation(2, OPERATION, [], NOW);

    await expect(
      repository.takeOverStaleCreation(
        OPERATION,
        new Date(NOW.getTime() - 30_000),
        new Date(NOW.getTime() + 30_000),
      ),
    ).resolves.toMatchObject({
      status: "in_progress",
      setupVersion: 2,
    });
    await expect(repository.getSnapshot()).resolves.toMatchObject({
      status: "creating",
      setupVersion: 3,
    });
  });

  it("linearizes concurrent expired-lease takeovers to one version transition", async () => {
    const competing = new CalendarRepository(
      new DrizzleCalendarStore(database()),
      OWNER,
      SUBJECT,
    );
    await repository.discover(1, [], NOW);
    await repository.beginCreation(2, OPERATION, [], NOW);
    const staleBefore = new Date(NOW.getTime() + 1);
    const takeoverTime = new Date(NOW.getTime() + 120_001);

    const [first, second] = await Promise.all([
      repository.takeOverStaleCreation(OPERATION, staleBefore, takeoverTime),
      competing.takeOverStaleCreation(OPERATION, staleBefore, takeoverTime),
    ]);

    expect(first).toMatchObject({ status: "retryable" });
    expect(second).toMatchObject({ status: "retryable" });
    await expect(repository.getSnapshot()).resolves.toMatchObject({
      status: "failed",
      setupVersion: 4,
      actionRequired: false,
    });
  });

  it("preserves an ambiguous action-required setup while terminalizing its ledger claim", async () => {
    await repository.discover(1, [], NOW);
    await repository.beginCreation(2, OPERATION, [], NOW);
    await repository.markCreationUncertain(OPERATION, "retryable", NOW);
    await expect(
      repository.markCreationUncertain(OPERATION, "action_required", NOW),
    ).resolves.toMatchObject({
      status: "failed",
      setupVersion: 5,
      actionRequired: true,
    });

    await expect(
      repository.markCreationDefiniteFailure(OPERATION, NOW),
    ).resolves.toMatchObject({
      status: "failed",
      setupVersion: 6,
      actionRequired: true,
    });
    await expect(repository.findCreationOperation(OPERATION)).resolves.toMatchObject({
      status: "definite_failure",
    });
    const unresolved = await pglite.query<{ operation_id: string }>(
      `select operation_id
       from operation_ledger
       where owner_id = $1
         and operation_kind = 'vision_calendar_create'
         and status in ('in_progress', 'retryable', 'action_required')`,
      [OWNER],
    );
    expect(unresolved.rows).toEqual([]);
  });

  it("does not terminalize a ledger when its stored setup version no longer matches", async () => {
    await repository.discover(1, [], NOW);
    await repository.beginCreation(2, OPERATION, [], NOW);
    await repository.markCreationUncertain(OPERATION, "retryable", NOW);
    await pglite.query(
      "update calendar_setup_states set setup_version = 99 where owner_id = $1",
      [OWNER],
    );

    await expect(
      repository.markCreationDefiniteFailure(OPERATION, NOW),
    ).rejects.toMatchObject({ code: "CALENDAR_PERSISTENCE_FAILED" });
    await expect(repository.findCreationOperation(OPERATION)).resolves.toMatchObject({
      status: "retryable",
    });
  });

  it("does not take over an expired ledger when its stored setup version no longer matches", async () => {
    await repository.discover(1, [], NOW);
    await repository.beginCreation(2, OPERATION, [], NOW);
    await pglite.query(
      "update calendar_setup_states set setup_version = 99 where owner_id = $1",
      [OWNER],
    );

    await expect(
      repository.takeOverStaleCreation(
        OPERATION,
        new Date(NOW.getTime() + 1),
        new Date(NOW.getTime() + 120_001),
      ),
    ).rejects.toMatchObject({ code: "CALENDAR_PERSISTENCE_FAILED" });
    await expect(repository.findCreationOperation(OPERATION)).resolves.toMatchObject({
      status: "in_progress",
    });
  });

  it("does not expose or take over another owner's expired operation", async () => {
    const other = new CalendarRepository(
      new DrizzleCalendarStore(database()),
      "usr_other",
      SUBJECT,
    );
    await repository.discover(1, [], NOW);
    await repository.beginCreation(2, OPERATION, [], NOW);

    await expect(
      other.takeOverStaleCreation(
        OPERATION,
        new Date(NOW.getTime() + 1),
        new Date(NOW.getTime() + 120_001),
      ),
    ).rejects.toMatchObject({ code: "CALENDAR_PERSISTENCE_FAILED" });
    await expect(repository.findCreationOperation(OPERATION)).resolves.toMatchObject({
      status: "in_progress",
    });
  });
});
