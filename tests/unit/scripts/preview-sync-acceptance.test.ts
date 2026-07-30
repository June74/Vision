import { describe, expect, it } from "vitest";
import {
  assertSyncSuppressionMargin,
  firstEligibleRepairTick,
  validateNormalSyncObservation,
  validateRepairObservation,
} from "../../../scripts/validate-preview-sync-acceptance";

const EXPIRES_AT = "2026-07-30T18:10:00.000Z";

describe("preview synchronization acceptance timing", () => {
  it.each([
    ["before_approval", "2026-07-30T18:05:00.000Z"],
    ["before_edit", "2026-07-30T18:06:00.000Z"],
  ] as const)("accepts the exact %s remaining-lifetime boundary", (stage, now) => {
    expect(() =>
      assertSyncSuppressionMargin(new Date(now), EXPIRES_AT, stage),
    ).not.toThrow();
  });

  it.each([
    ["before_approval", "2026-07-30T18:05:00.001Z"],
    ["before_edit", "2026-07-30T18:06:00.001Z"],
  ] as const)("rejects one millisecond below the %s margin", (stage, now) => {
    expect(() =>
      assertSyncSuppressionMargin(new Date(now), EXPIRES_AT, stage),
    ).toThrow("Preview synchronization acceptance is invalid.");
  });

  it.each([
    [new Date("invalid"), EXPIRES_AT],
    [new Date("2026-07-30T18:00:00.000Z"), "2026-07-30T18:10:00Z"],
  ])("rejects malformed timing without retaining input", (now, expiresAt) => {
    expect(() =>
      assertSyncSuppressionMargin(now, expiresAt, "before_approval"),
    ).toThrow("Preview synchronization acceptance is invalid.");
  });

  it.each([0, 120_000])(
    "accepts normal visibility at %i milliseconds with zero counter drift",
    (elapsedMilliseconds) => {
      expect(
        validateNormalSyncObservation({
          providerCompletedAt: new Date("2026-07-30T18:00:00.000Z"),
          visibleAt: new Date(
            new Date("2026-07-30T18:00:00.000Z").getTime() +
              elapsedMilliseconds,
          ),
          nextMaintenanceTick: new Date("2026-07-30T18:15:00.000Z"),
          retryCountDelta: 0,
          failureCountDelta: 0,
        }),
      ).toStrictEqual({ elapsedMilliseconds });
    },
  );

  it.each([
    {
      visibleAt: "2026-07-30T18:02:00.001Z",
      nextMaintenanceTick: "2026-07-30T18:15:00.000Z",
      retryCountDelta: 0,
      failureCountDelta: 0,
    },
    {
      visibleAt: "2026-07-30T18:01:00.000Z",
      nextMaintenanceTick: "2026-07-30T18:15:00.000Z",
      retryCountDelta: 1,
      failureCountDelta: 0,
    },
    {
      visibleAt: "2026-07-30T18:15:00.000Z",
      nextMaintenanceTick: "2026-07-30T18:15:00.000Z",
      retryCountDelta: 0,
      failureCountDelta: 0,
    },
  ])("rejects late, drifted, or maintenance-overlapping normal sync", (fixture) => {
    expect(() =>
      validateNormalSyncObservation({
        providerCompletedAt: new Date("2026-07-30T18:00:00.000Z"),
        visibleAt: new Date(fixture.visibleAt),
        nextMaintenanceTick: new Date(fixture.nextMaintenanceTick),
        retryCountDelta: fixture.retryCountDelta,
        failureCountDelta: fixture.failureCountDelta,
      }),
    ).toThrow("Preview synchronization acceptance is invalid.");
  });

  it.each([
    ["2026-07-30T18:00:00.000Z", "2026-07-30T18:15:00.000Z"],
    ["2026-07-30T18:00:00.001Z", "2026-07-30T18:30:00.000Z"],
    ["2026-07-30T18:14:59.999Z", "2026-07-30T18:30:00.000Z"],
    ["2026-07-30T18:15:00.001Z", "2026-07-30T18:45:00.000Z"],
  ])("selects the first quarter-hour satisfying the safe anchor", (anchor, expected) => {
    expect(firstEligibleRepairTick(new Date(anchor)).toISOString()).toBe(expected);
  });

  it("recomputes repair eligibility from the supplied anchor and requires reserved", () => {
    expect(() =>
      validateRepairObservation({
        anchor: new Date("2026-07-30T18:00:00.001Z"),
        observedTick: new Date("2026-07-30T18:30:00.000Z"),
        repairOutcome: "reserved",
        visibleAt: new Date("2026-07-30T18:44:59.999Z"),
        retryCountDelta: 0,
        failureCountDelta: 0,
      }),
    ).not.toThrow();

    expect(() =>
      validateRepairObservation({
        anchor: new Date("2026-07-30T18:00:00.001Z"),
        observedTick: new Date("2026-07-30T18:15:00.000Z"),
        repairOutcome: "reserved",
        visibleAt: new Date("2026-07-30T18:20:00.000Z"),
        retryCountDelta: 0,
        failureCountDelta: 0,
      }),
    ).toThrow("Preview synchronization acceptance is invalid.");
    expect(() =>
      validateRepairObservation({
        anchor: new Date("2026-07-30T18:00:00.001Z"),
        observedTick: new Date("2026-07-30T18:30:00.000Z"),
        repairOutcome: "no_work",
        visibleAt: new Date("2026-07-30T18:40:00.000Z"),
        retryCountDelta: 0,
        failureCountDelta: 0,
      }),
    ).toThrow("Preview synchronization acceptance is invalid.");
  });
});
