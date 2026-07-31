import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VisionDatabase } from "../../../src/data/db";
import type { PreviewAiEvidenceWindow } from "../../../src/domain/operations/temporary-preview-fault";
import {
  createProductionScheduledPhaseBAiUsageEvidenceDependencies,
  createScheduledPhaseBAiUsageEvidenceDependencies,
  runScheduledPhaseBAiUsageEvidence,
} from "../../../src/jobs/scheduled";

const OWNER = "owner";
const NOW = new Date("2026-07-25T17:00:00.000Z");
const EVIDENCE_AT = new Date("2026-07-25T17:05:00.000Z");
const MONTH = "2026-07";
const WINDOW: PreviewAiEvidenceWindow = Object.freeze({
  activatedAt: new Date("2026-07-25T16:35:00.001Z"),
  evidenceScheduledAt: EVIDENCE_AT,
  expiresAt: new Date("2026-07-25T17:05:00.001Z"),
});

let postgres: PGlite;
let database: VisionDatabase;

beforeEach(async () => {
  postgres = new PGlite();
  for (const migration of [
    "0001_phase_b_foundation.sql",
    "0002_google_auth_sessions.sql",
    "0003_calendar_setup.sql",
    "0004_incremental_event_sync.sql",
    "0005_google_notification_jobs.sql",
    "0006_google_channel_lifecycle.sql",
    "0007_calendar_maintenance_state.sql",
    "0008_google_projection_rebuild.sql",
    "0009_ai_usage_budget.sql",
  ]) {
    await postgres.exec(
      await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
    );
  }
  database = drizzle(postgres) as unknown as VisionDatabase;
});

afterEach(async () => {
  await postgres.close();
});

async function insertHardStopLifecycle() {
  const dispatchedAt = new Date(NOW.getTime() + 1_000);
  const settledAt = new Date(NOW.getTime() + 2_000);
  await postgres.query(
    `insert into ai_usage_months (
       owner_id, budget_month, settled_cents, reserved_cents,
       created_at, updated_at
     ) values ($1, $2, 950, 0, $3, $4)`,
    [OWNER, MONTH, NOW.toISOString(), settledAt.toISOString()],
  );
  await postgres.query(
    `insert into ai_usage_reservations (
       id, owner_id, budget_month, idempotency_key, request_class, status,
       estimated_cents, actual_cents, created_at, expires_at,
       dispatched_at, completed_at
     ) values (
       'hard-stop', $1, $2, 'hard-stop-operation', 'routine', 'settled',
       10, 950, $3, $4, $5, $6
     )`,
    [
      OWNER,
      MONTH,
      NOW.toISOString(),
      new Date(NOW.getTime() + 60_000).toISOString(),
      dispatchedAt.toISOString(),
      settledAt.toISOString(),
    ],
  );
  await postgres.query(
    `insert into ai_usage_ledger (
       id, reservation_id, owner_id, budget_month, event_type,
       estimated_cents, actual_cents, occurred_at
     ) values
       ('hard-stop:reserved', 'hard-stop', $1, $2, 'reserved', 10, null, $3),
       ('hard-stop:dispatched', 'hard-stop', $1, $2, 'dispatched', 10, null, $4),
       ('hard-stop:settled', 'hard-stop', $1, $2, 'settled', 10, 950, $5)`,
    [
      OWNER,
      MONTH,
      NOW.toISOString(),
      dispatchedAt.toISOString(),
      settledAt.toISOString(),
    ],
  );
}

describe("scheduled Phase B AI usage candidate seam", () => {
  it("runs real usage, status, and calendar reads and emits one terminal record", async () => {
    await insertHardStopLifecycle();
    const created = createScheduledPhaseBAiUsageEvidenceDependencies(
      database,
      OWNER,
      true,
    );
    const readStatus = vi.fn(created.readStatus);
    const readCalendar = vi.fn(created.readCalendar);
    const write = vi.fn();

    await runScheduledPhaseBAiUsageEvidence(
      EVIDENCE_AT,
      WINDOW,
      { ...created, readStatus, readCalendar },
      write,
    );

    expect(readStatus).toHaveBeenCalledOnce();
    expect(readCalendar).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith({
      action: "acceptance.ai-usage",
      evidence: expect.objectContaining({
        outcome: "succeeded",
        category: "none",
        monthlyCents: 950,
        tier: "stopped",
        gatewayLimitMatches: true,
        nonAiAvailable: true,
      }),
    });
  });

  it.each([
    [0, 0],
    [1, 0],
  ] as const)(
    "waits for candidate counts %i/%i without monthly, status, calendar, or terminal reads",
    async (createdRequestCount, eligibleSettledRequestCount) => {
      const dependencies = {
        readCandidateRequestCounts: vi.fn(async () => ({
          createdRequestCount,
          eligibleSettledRequestCount,
        })),
        read: vi.fn(async () => ({ monthlyCents: 950 })),
        readStatus: vi.fn(async () => undefined),
        readCalendar: vi.fn(async () => undefined),
        gatewayLimitMatches: true,
      };
      const write = vi.fn();

      await expect(
        runScheduledPhaseBAiUsageEvidence(
          EVIDENCE_AT,
          WINDOW,
          dependencies,
          write,
        ),
      ).resolves.toBe("waiting");

      expect(dependencies.readCandidateRequestCounts).toHaveBeenCalledExactlyOnceWith({
        activatedAt: WINDOW.activatedAt,
        evidenceScheduledAt: WINDOW.evidenceScheduledAt,
      });
      expect(dependencies.read).not.toHaveBeenCalled();
      expect(dependencies.readStatus).not.toHaveBeenCalled();
      expect(dependencies.readCalendar).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    },
  );

  it.each([
    [0, 1],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
    [-1, 0],
    [1.5, 1],
  ] as const)(
    "emits one closed inconsistent terminal and rejects candidate counts %s/%s",
    async (createdRequestCount, eligibleSettledRequestCount) => {
      const dependencies = {
        readCandidateRequestCounts: vi.fn(async () => ({
          createdRequestCount,
          eligibleSettledRequestCount,
        })),
        read: vi.fn(async () => ({ monthlyCents: 950 })),
        readStatus: vi.fn(async () => undefined),
        readCalendar: vi.fn(async () => undefined),
        gatewayLimitMatches: true,
      };
      const write = vi.fn();

      await expect(
        runScheduledPhaseBAiUsageEvidence(
          EVIDENCE_AT,
          WINDOW,
          dependencies,
          write,
        ),
      ).rejects.toThrow("Phase B AI usage candidate is inconsistent.");

      expect(dependencies.read).not.toHaveBeenCalled();
      expect(dependencies.readStatus).not.toHaveBeenCalled();
      expect(dependencies.readCalendar).not.toHaveBeenCalled();
      expect(write).toHaveBeenCalledExactlyOnceWith({
        action: "acceptance.ai-usage",
        evidence: {
          evidenceType: "vision.ai-usage/v1",
          outcome: "failed",
          category: "inconsistent",
          monthlyCents: 0,
          warningAtCents: 800,
          optionalStopAtCents: 900,
          hardStopAtCents: 950,
          tier: "normal",
          gatewayLimitMatches: false,
          nonAiAvailable: false,
        },
      });
    },
  );

  it("allows duplicate delivery to emit twice so observer uniqueness can reject it", async () => {
    const dependencies = {
      readCandidateRequestCounts: vi.fn(async () => ({
        createdRequestCount: 1,
        eligibleSettledRequestCount: 1,
      })),
      read: vi.fn(async () => ({ monthlyCents: 950 })),
      readStatus: vi.fn(async () => undefined),
      readCalendar: vi.fn(async () => undefined),
      gatewayLimitMatches: true,
    };
    const write = vi.fn();

    await expect(
      runScheduledPhaseBAiUsageEvidence(EVIDENCE_AT, WINDOW, dependencies, write),
    ).resolves.toBe("emitted");
    await expect(
      runScheduledPhaseBAiUsageEvidence(EVIDENCE_AT, WINDOW, dependencies, write),
    ).resolves.toBe("emitted");

    expect(dependencies.readCandidateRequestCounts).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("rejects an unverified Task 6 admission boolean before any read", () => {
    expect(() =>
      createScheduledPhaseBAiUsageEvidenceDependencies(
        database,
        OWNER,
        false,
      ),
    ).toThrow("Phase B AI usage candidate is unavailable.");
  });

  it("keeps production composition preview-only and candidate-attested", async () => {
    await expect(
      createProductionScheduledPhaseBAiUsageEvidenceDependencies(
        { VISION_ENV: "production" } as never,
        true,
      ),
    ).rejects.toThrow("Phase B AI usage candidate is unavailable.");
    await expect(
      createProductionScheduledPhaseBAiUsageEvidenceDependencies(
        { VISION_ENV: "preview" } as never,
        false,
      ),
    ).rejects.toThrow("Phase B AI usage candidate is unavailable.");
  });
});
