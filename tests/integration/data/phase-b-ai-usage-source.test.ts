import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VisionDatabase } from "../../../src/data/db";
import {
  PhaseBAiUsageSourceError,
  createPhaseBAiUsageSource,
} from "../../../src/data/phase-b-ai-usage-source";
import {
  createAiUsageRepository,
  type AiUsageRepository,
} from "../../../src/data/repositories/ai-usage-repository";

const OWNER = "owner";
const OTHER_OWNER = "other-owner";
const MONTH = "2026-07";
const NOW = new Date("2026-07-25T17:00:00.000Z");
const ACTIVATED_AT = new Date("2026-07-25T16:35:00.000Z");
const EVIDENCE_SCHEDULED_AT = new Date("2026-07-25T17:05:00.000Z");

let postgres: PGlite;
let database: VisionDatabase;
let repository: AiUsageRepository;

beforeEach(async () => {
  postgres = new PGlite();
  await postgres.exec(
    await readFile(
      resolve(process.cwd(), "migrations/0009_ai_usage_budget.sql"),
      "utf8",
    ),
  );
  database = drizzle(postgres) as unknown as VisionDatabase;
  repository = createAiUsageRepository(database);
});

afterEach(async () => {
  await postgres.close();
});

function source() {
  return createPhaseBAiUsageSource(database, OWNER);
}

async function reserve(
  reservationId: string,
  estimatedCents = 10,
  now = NOW,
  expiresAt = new Date(now.getTime() + 60_000),
) {
  return repository.reserve({
    reservationId,
    ownerId: OWNER,
    idempotencyKey: `${reservationId}-operation`,
    requestClass: "routine",
    estimatedCents,
    now,
    expiresAt,
  });
}

async function dispatch(
  reservationId: string,
  now = new Date(NOW.getTime() + 1_000),
  expiresAt = new Date(NOW.getTime() + 60_000),
) {
  return repository.markDispatched(
    reservationId,
    OWNER,
    now,
    expiresAt,
  );
}

async function settle(
  reservationId: string,
  actualCents: number,
  now = new Date(NOW.getTime() + 2_000),
) {
  return repository.settle({
    reservationId,
    ownerId: OWNER,
    actualCents,
    metadata: {},
    now,
  });
}

async function createSettledEstimate(reservationId: string) {
  const createdAt = new Date(NOW.getTime() - 120_000);
  const expiresAt = new Date(NOW.getTime() - 60_000);
  await reserve(reservationId, 10, createdAt, expiresAt);
  await dispatch(
    reservationId,
    new Date(createdAt.getTime() + 1_000),
    expiresAt,
  );
  const takeoverId = `${reservationId}-takeover`;
  await reserve(takeoverId);
  await repository.release(takeoverId, OWNER, new Date(NOW.getTime() + 1));
}

function sourceWith(row: Record<string, unknown>) {
  const execute = vi.fn(async () => ({ rows: [row] }));
  return createPhaseBAiUsageSource({ execute } as never, OWNER);
}

function aggregateRow(override: Record<string, unknown> = {}) {
  return {
    monthRowCount: "1",
    settledCents: "800",
    reservedCents: "150",
    ledgerSettledCents: "800",
    ledgerReservedCents: "150",
    reservationCount: "2",
    ledgerActivityCount: "5",
    ownerMonthMismatchCount: "0",
    invalidTransitionCount: "0",
    ...override,
  };
}

function candidateWindow() {
  return {
    activatedAt: ACTIVATED_AT,
    evidenceScheduledAt: EVIDENCE_SCHEDULED_AT,
  };
}

describe("Phase B AI usage source", () => {
  it("returns zero for a genuinely empty owner month", async () => {
    await expect(source().read(MONTH)).resolves.toEqual({ monthlyCents: 0 });
  });

  it("returns zero for an existing empty month row", async () => {
    await postgres.query(
      `insert into ai_usage_months (
         owner_id, budget_month, settled_cents, reserved_cents,
         created_at, updated_at
       ) values ($1, $2, 0, 0, $3, $3)`,
      [OWNER, MONTH, NOW.toISOString()],
    );

    await expect(source().read(MONTH)).resolves.toEqual({ monthlyCents: 0 });
  });

  it("rejects a missing month row when released lifecycle activity exists", async () => {
    await postgres.query(
      `insert into ai_usage_reservations (
         id, owner_id, budget_month, idempotency_key, request_class, status,
         estimated_cents, created_at, expires_at, completed_at
       ) values ($1, $2, $3, $4, 'routine', 'released', 10, $5, $6, $6)`,
      [
        "released-without-month",
        OWNER,
        MONTH,
        "released-without-month-operation",
        NOW.toISOString(),
        new Date(NOW.getTime() + 60_000).toISOString(),
      ],
    );
    await postgres.query(
      `insert into ai_usage_ledger (
         id, reservation_id, owner_id, budget_month, event_type,
         estimated_cents, occurred_at
       ) values
         ($1, $3, $4, $5, 'reserved', 10, $6),
         ($2, $3, $4, $5, 'released', 10, $7)`,
      [
        "released-without-month:reserved",
        "released-without-month:released",
        "released-without-month",
        OWNER,
        MONTH,
        NOW.toISOString(),
        new Date(NOW.getTime() + 60_000).toISOString(),
      ],
    );

    await expect(source().read(MONTH)).rejects.toMatchObject({
      category: "inconsistent",
    });
  });

  it("reconstructs an admitted reserved lifecycle once", async () => {
    await reserve("reserved");

    await expect(source().read(MONTH)).resolves.toEqual({
      monthlyCents: 10,
    });
  });

  it("reconstructs an admitted dispatched lifecycle once", async () => {
    await reserve("dispatched");
    await dispatch("dispatched");

    await expect(source().read(MONTH)).resolves.toEqual({
      monthlyCents: 10,
    });
  });

  it("reconstructs an admitted released lifecycle once", async () => {
    await reserve("released");
    await repository.release("released", OWNER, new Date(NOW.getTime() + 1));

    await expect(source().read(MONTH)).resolves.toEqual({ monthlyCents: 0 });
  });

  it("reconstructs an admitted direct settlement once", async () => {
    await reserve("settled");
    await dispatch("settled");
    await settle("settled", 4);

    await expect(source().read(MONTH)).resolves.toEqual({ monthlyCents: 4 });
  });

  it("reconstructs an admitted conservative settlement once", async () => {
    await createSettledEstimate("settled-estimate");

    await expect(source().read(MONTH)).resolves.toEqual({
      monthlyCents: 10,
    });
  });

  it("replaces a conservative settlement with one late exact settlement", async () => {
    await createSettledEstimate("late-exact");
    await settle("late-exact", 25, new Date(NOW.getTime() + 2_000));

    await expect(source().read(MONTH)).resolves.toEqual({
      monthlyCents: 25,
    });
  });

  it("rejects a duplicate dispatched transition", async () => {
    await reserve("duplicate-dispatch");
    await dispatch("duplicate-dispatch");
    await postgres.query(
      `insert into ai_usage_ledger (
         id, reservation_id, owner_id, budget_month, event_type,
         estimated_cents, occurred_at
       ) values ($1, $2, $3, $4, 'dispatched', 10, $5)`,
      [
        "duplicate-dispatch:dispatched-again",
        "duplicate-dispatch",
        OWNER,
        MONTH,
        new Date(NOW.getTime() + 2_000).toISOString(),
      ],
    );

    await expect(source().read(MONTH)).rejects.toMatchObject({
      category: "inconsistent",
    });
  });

  it("rejects lifecycle events in an invalid temporal order", async () => {
    await reserve("invalid-order");
    await dispatch("invalid-order");
    await postgres.query(
      `update ai_usage_ledger
       set occurred_at = case event_type
         when 'reserved' then $2::timestamptz
         when 'dispatched' then $3::timestamptz
         else occurred_at
       end
       where reservation_id = $1`,
      [
        "invalid-order",
        new Date(NOW.getTime() + 2_000).toISOString(),
        new Date(NOW.getTime() + 1_000).toISOString(),
      ],
    );

    await expect(source().read(MONTH)).rejects.toMatchObject({
      category: "inconsistent",
    });
  });

  it("rejects ledger history that disagrees with current reservation state", async () => {
    await reserve("state-disagreement");
    await dispatch("state-disagreement");
    await postgres.query(
      `update ai_usage_reservations
       set status = 'reserved', dispatched_at = null
       where id = $1`,
      ["state-disagreement"],
    );

    await expect(source().read(MONTH)).rejects.toMatchObject({
      category: "inconsistent",
    });
  });

  it("rejects ledger activity attributed to another owner or month", async () => {
    await postgres.query(
      `insert into ai_usage_reservations (
         id, owner_id, budget_month, idempotency_key, request_class, status,
         estimated_cents, created_at, expires_at
       ) values ($1, $2, '2026-06', $3, 'routine', 'reserved', 10, $4, $5)`,
      [
        "foreign-reservation",
        OTHER_OWNER,
        "foreign-operation",
        NOW.toISOString(),
        new Date(NOW.getTime() + 60_000).toISOString(),
      ],
    );
    await postgres.query(
      `insert into ai_usage_ledger (
         id, reservation_id, owner_id, budget_month, event_type,
         estimated_cents, occurred_at
       ) values ($1, $2, $3, $4, 'reserved', 10, $5)`,
      [
        "foreign-reservation:misattributed",
        "foreign-reservation",
        OWNER,
        MONTH,
        NOW.toISOString(),
      ],
    );

    await expect(source().read(MONTH)).rejects.toMatchObject({
      category: "inconsistent",
    });
  });

  it("rejects individually unsafe aggregate cells", async () => {
    const unsafe = String(Number.MAX_SAFE_INTEGER + 1);

    await expect(
      sourceWith(
        aggregateRow({
          settledCents: unsafe,
          ledgerSettledCents: unsafe,
        }),
      ).read(MONTH),
    ).rejects.toBeInstanceOf(PhaseBAiUsageSourceError);
  });

  it("rejects overflow when reconstructed and month totals otherwise agree", async () => {
    const max = String(Number.MAX_SAFE_INTEGER);

    await expect(
      sourceWith(
        aggregateRow({
          settledCents: max,
          reservedCents: "1",
          ledgerSettledCents: max,
          ledgerReservedCents: "1",
        }),
      ).read(MONTH),
    ).rejects.toMatchObject({ category: "inconsistent" });
  });

  it("rejects a malformed aggregate cell", async () => {
    await expect(
      sourceWith(aggregateRow({ settledCents: "not-a-number" })).read(MONTH),
    ).rejects.toBeInstanceOf(PhaseBAiUsageSourceError);
  });

  it("counts active reservations owner-wide across accounting months", async () => {
    await reserve(
      "prior-month-active",
      10,
      new Date("2026-06-30T23:00:00.000Z"),
      new Date("2026-08-01T00:00:00.000Z"),
    );

    await expect(source().countActiveRequests()).resolves.toBe(1);
  });

  it("returns the active count from exactly one database statement", async () => {
    const execute = vi.fn(async () => ({
      rows: [{
        activeRequestCount: "1",
        ownerMonthMismatchCount: "0",
        invalidTransitionCount: "0",
      }],
    }));
    const aggregateSource = createPhaseBAiUsageSource(
      { execute } as never,
      OWNER,
    );

    await expect(aggregateSource.countActiveRequests()).resolves.toBe(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["negative", "-1"],
    ["unsafe", String(Number.MAX_SAFE_INTEGER + 1)],
    ["noncanonical", "01"],
    ["fractional", 1.5],
  ])("rejects a %s active-count aggregate cell", async (_label, value) => {
    const execute = vi.fn(async () => ({
      rows: [{
        activeRequestCount: value,
        ownerMonthMismatchCount: "0",
        invalidTransitionCount: "0",
      }],
    }));
    const aggregateSource = createPhaseBAiUsageSource(
      { execute } as never,
      OWNER,
    );

    await expect(
      aggregateSource.countActiveRequests(),
    ).rejects.toMatchObject({ category: "inconsistent" });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("counts only reserved and dispatched reservations as active", async () => {
    await reserve("released-active-check");
    await repository.release(
      "released-active-check",
      OWNER,
      new Date(NOW.getTime() + 1),
    );
    await reserve("settled-active-check");
    await dispatch("settled-active-check");
    await settle("settled-active-check", 4);
    await reserve("dispatched-active-check");
    await dispatch("dispatched-active-check");

    await expect(source().countActiveRequests()).resolves.toBe(1);
  });

  it("does not count a conservative settlement as active", async () => {
    await createSettledEstimate("estimate-active-check");

    await expect(source().countActiveRequests()).resolves.toBe(0);
  });

  it("excludes foreign-owner active reservations", async () => {
    await repository.reserve({
      reservationId: "foreign-active",
      ownerId: OTHER_OWNER,
      idempotencyKey: "foreign-active-operation",
      requestClass: "routine",
      estimatedCents: 10,
      now: NOW,
      expiresAt: new Date(NOW.getTime() + 60_000),
    });

    await expect(source().countActiveRequests()).resolves.toBe(0);
  });

  it("fails the active count closed for inconsistent lifecycle history", async () => {
    await reserve("active-state-disagreement");
    await dispatch("active-state-disagreement");
    await postgres.query(
      `update ai_usage_reservations
       set status = 'reserved', dispatched_at = null
       where id = $1`,
      ["active-state-disagreement"],
    );

    await expect(source().countActiveRequests()).rejects.toMatchObject({
      category: "inconsistent",
    });
  });

  it("returns created and eligible candidate counts from one frozen snapshot", async () => {
    const execute = vi.fn(async () => ({
      rows: [{
        createdRequestCount: "2",
        eligibleSettledRequestCount: "1",
        ownerMonthMismatchCount: "0",
        candidateMonthMismatchCount: "0",
        invalidTransitionCount: "0",
      }],
    }));
    const aggregateSource = createPhaseBAiUsageSource(
      { execute } as never,
      OWNER,
    );

    const result = await aggregateSource.readCandidateRequestCounts(
      candidateWindow(),
    );

    expect(result).toEqual({
      createdRequestCount: 2,
      eligibleSettledRequestCount: 1,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("counts every in-window lifecycle but only exact pre-evidence settlement as eligible", async () => {
    await reserve("candidate-released", 10, new Date(NOW.getTime() - 5_000));
    await repository.release(
      "candidate-released",
      OWNER,
      new Date(NOW.getTime() - 4_000),
    );
    await reserve("candidate-settled");
    await dispatch("candidate-settled");
    await settle("candidate-settled", 4);
    await reserve(
      "candidate-dispatched",
      10,
      new Date(NOW.getTime() + 3_000),
      new Date(NOW.getTime() + 60_000),
    );
    await dispatch(
      "candidate-dispatched",
      new Date(NOW.getTime() + 4_000),
      new Date(NOW.getTime() + 60_000),
    );

    await expect(
      source().readCandidateRequestCounts(candidateWindow()),
    ).resolves.toEqual({
      createdRequestCount: 3,
      eligibleSettledRequestCount: 1,
    });
  });

  it("counts conservative settlement lifecycle rows as created but not eligible", async () => {
    await createSettledEstimate("candidate-estimate");

    await expect(
      source().readCandidateRequestCounts(candidateWindow()),
    ).resolves.toEqual({
      createdRequestCount: 2,
      eligibleSettledRequestCount: 0,
    });
  });

  it("applies inclusive activation and strict evidence creation boundaries", async () => {
    await reserve(
      "before-activation",
      10,
      new Date(ACTIVATED_AT.getTime() - 1),
      new Date(ACTIVATED_AT.getTime() + 1_000),
    );
    await repository.release(
      "before-activation",
      OWNER,
      ACTIVATED_AT,
    );
    await reserve(
      "at-activation",
      10,
      ACTIVATED_AT,
      new Date(ACTIVATED_AT.getTime() + 2_000),
    );
    await repository.release(
      "at-activation",
      OWNER,
      new Date(ACTIVATED_AT.getTime() + 1_000),
    );
    await reserve(
      "at-evidence",
      10,
      EVIDENCE_SCHEDULED_AT,
      new Date(EVIDENCE_SCHEDULED_AT.getTime() + 2_000),
    );

    await expect(
      source().readCandidateRequestCounts(candidateWindow()),
    ).resolves.toEqual({
      createdRequestCount: 1,
      eligibleSettledRequestCount: 0,
    });
  });

  it("excludes settlement completed at or after the evidence instant", async () => {
    await reserve("settled-at-evidence");
    await dispatch("settled-at-evidence");
    await settle("settled-at-evidence", 4, EVIDENCE_SCHEDULED_AT);
    await reserve("settled-after-evidence", 10, new Date(NOW.getTime() + 1));
    await dispatch(
      "settled-after-evidence",
      new Date(NOW.getTime() + 2_000),
      new Date(EVIDENCE_SCHEDULED_AT.getTime() + 10_000),
    );
    await settle(
      "settled-after-evidence",
      4,
      new Date(EVIDENCE_SCHEDULED_AT.getTime() + 1),
    );

    await expect(
      source().readCandidateRequestCounts(candidateWindow()),
    ).resolves.toEqual({
      createdRequestCount: 2,
      eligibleSettledRequestCount: 0,
    });
  });

  it("excludes foreign-owner rows from both candidate counts", async () => {
    await repository.reserve({
      reservationId: "foreign-candidate",
      ownerId: OTHER_OWNER,
      idempotencyKey: "foreign-candidate-operation",
      requestClass: "routine",
      estimatedCents: 10,
      now: NOW,
      expiresAt: new Date(NOW.getTime() + 60_000),
    });

    await expect(
      source().readCandidateRequestCounts(candidateWindow()),
    ).resolves.toEqual({
      createdRequestCount: 0,
      eligibleSettledRequestCount: 0,
    });
  });

  it("fails closed for an in-window reservation in the wrong Chicago month", async () => {
    await postgres.query(
      `insert into ai_usage_reservations (
         id, owner_id, budget_month, idempotency_key, request_class, status,
         estimated_cents, created_at, expires_at
       ) values ($1, $2, '2026-06', $3, 'routine', 'reserved', 10, $4, $5)`,
      [
        "wrong-candidate-month",
        OWNER,
        "wrong-candidate-month-operation",
        NOW.toISOString(),
        new Date(NOW.getTime() + 60_000).toISOString(),
      ],
    );
    await postgres.query(
      `insert into ai_usage_ledger (
         id, reservation_id, owner_id, budget_month, event_type,
         estimated_cents, occurred_at
       ) values ($1, $2, $3, '2026-06', 'reserved', 10, $4)`,
      [
        "wrong-candidate-month:reserved",
        "wrong-candidate-month",
        OWNER,
        NOW.toISOString(),
      ],
    );

    await expect(
      source().readCandidateRequestCounts(candidateWindow()),
    ).rejects.toMatchObject({ category: "inconsistent" });
  });

  it("fails candidate counts closed for inconsistent current lifecycle state", async () => {
    await reserve("candidate-state-disagreement");
    await dispatch("candidate-state-disagreement");
    await postgres.query(
      `update ai_usage_reservations
       set status = 'reserved', dispatched_at = null
       where id = $1`,
      ["candidate-state-disagreement"],
    );

    await expect(
      source().readCandidateRequestCounts(candidateWindow()),
    ).rejects.toMatchObject({ category: "inconsistent" });
  });

  it("fails candidate counts closed for ledger owner and month mismatch", async () => {
    await reserve("candidate-ledger-attribution");
    await postgres.query(
      `update ai_usage_ledger
       set owner_id = $2, budget_month = '2026-06'
       where reservation_id = $1`,
      ["candidate-ledger-attribution", OTHER_OWNER],
    );

    await expect(
      source().readCandidateRequestCounts(candidateWindow()),
    ).rejects.toMatchObject({ category: "inconsistent" });
  });

  it("rejects invalid or cross-month candidate windows before reading", async () => {
    const execute = vi.fn(async () => ({ rows: [] }));
    const aggregateSource = createPhaseBAiUsageSource(
      { execute } as never,
      OWNER,
    );

    await expect(
      aggregateSource.readCandidateRequestCounts({
        activatedAt: new Date("2026-07-31T23:59:59.999-05:00"),
        evidenceScheduledAt: new Date("2026-08-01T00:00:00.000-05:00"),
      }),
    ).rejects.toMatchObject({ category: "unavailable" });
    await expect(
      aggregateSource.readCandidateRequestCounts({
        activatedAt: EVIDENCE_SCHEDULED_AT,
        evidenceScheduledAt: ACTIVATED_AT,
      }),
    ).rejects.toMatchObject({ category: "unavailable" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects unsafe candidate aggregate cells", async () => {
    const unsafe = String(Number.MAX_SAFE_INTEGER + 1);
    const execute = vi.fn(async () => ({
      rows: [{
        createdRequestCount: unsafe,
        eligibleSettledRequestCount: "0",
        ownerMonthMismatchCount: "0",
        candidateMonthMismatchCount: "0",
        invalidTransitionCount: "0",
      }],
    }));
    const aggregateSource = createPhaseBAiUsageSource(
      { execute } as never,
      OWNER,
    );

    await expect(
      aggregateSource.readCandidateRequestCounts(candidateWindow()),
    ).rejects.toMatchObject({ category: "inconsistent" });
  });
});
