import { describe, expect, it } from "vitest";
import {
  calculateFoundationHealth,
  FOUNDATION_HEALTH_THRESHOLDS,
  type FoundationHealthFacts,
} from "../../../src/domain/operations/health";

const NOW = new Date("2026-07-25T17:00:00.000Z");

function facts(
  overrides: Partial<FoundationHealthFacts> = {},
): FoundationHealthFacts {
  return {
    authorizationState: "connected",
    checkpointStatus: "connected",
    lastSuccessfulSyncAt: new Date(NOW.getTime() - 60_000),
    oldestQueuedJobAt: null,
    queueRetryCount: 0,
    failedJobCount: 0,
    channelExpiresAt: new Date(
      NOW.getTime() + FOUNDATION_HEALTH_THRESHOLDS.channelRenewalWarningMs + 1,
    ),
    databaseAvailable: true,
    databaseUsageWarning: false,
    r2UsageWarning: false,
    aiMonthlyCents: 0,
    safeErrorCode: null,
    ...overrides,
  };
}

describe("calculateFoundationHealth", () => {
  it("reports healthy with explicit freshness ages and no warning codes", () => {
    expect(calculateFoundationHealth(facts(), NOW)).toEqual({
      state: "Healthy",
      syncDelayMs: 60_000,
      oldestJobDelayMs: null,
      aiSpendTier: "normal",
      warningCodes: [],
    });
  });

  it("reports delayed when the last successful sync reaches the exact threshold", () => {
    const result = calculateFoundationHealth(
      facts({
        lastSuccessfulSyncAt: new Date(
          NOW.getTime() - FOUNDATION_HEALTH_THRESHOLDS.syncFreshnessMs,
        ),
      }),
      NOW,
    );

    expect(result).toMatchObject({
      state: "Delayed",
      syncDelayMs: FOUNDATION_HEALTH_THRESHOLDS.syncFreshnessMs,
      warningCodes: ["SYNC_DELAYED"],
    });
  });

  it("reports delayed when the oldest queued job reaches the exact threshold", () => {
    const result = calculateFoundationHealth(
      facts({
        oldestQueuedJobAt: new Date(
          NOW.getTime() - FOUNDATION_HEALTH_THRESHOLDS.queueFreshnessMs,
        ),
        queueRetryCount: 2,
      }),
      NOW,
    );

    expect(result).toMatchObject({
      state: "Delayed",
      oldestJobDelayMs: FOUNDATION_HEALTH_THRESHOLDS.queueFreshnessMs,
      warningCodes: ["QUEUE_DELAYED"],
    });
  });

  it("reports action required for failed jobs and keeps it above delayed facts", () => {
    const result = calculateFoundationHealth(
      facts({
        failedJobCount: 1,
        oldestQueuedJobAt: new Date(
          NOW.getTime() - FOUNDATION_HEALTH_THRESHOLDS.queueFreshnessMs,
        ),
      }),
      NOW,
    );

    expect(result.state).toBe("Action required");
    expect(result.warningCodes).toEqual(["FAILED_JOBS", "QUEUE_DELAYED"]);
  });

  it("reports action required for an expired channel", () => {
    expect(
      calculateFoundationHealth(
        facts({ channelExpiresAt: new Date(NOW.getTime()) }),
        NOW,
      ),
    ).toMatchObject({
      state: "Action required",
      warningCodes: ["CHANNEL_EXPIRED"],
    });
  });

  it("reports delayed while a channel is inside the renewal window", () => {
    expect(
      calculateFoundationHealth(
        facts({
          channelExpiresAt: new Date(
            NOW.getTime() + FOUNDATION_HEALTH_THRESHOLDS.channelRenewalWarningMs,
          ),
        }),
        NOW,
      ),
    ).toMatchObject({
      state: "Delayed",
      warningCodes: ["CHANNEL_EXPIRING"],
    });
  });

  it("reports disconnected for revoked authorization above every other failure", () => {
    const result = calculateFoundationHealth(
      facts({
        authorizationState: "revoked",
        databaseAvailable: false,
        failedJobCount: 1,
      }),
      NOW,
    );

    expect(result.state).toBe("Disconnected");
    expect(result.warningCodes).toEqual([
      "AUTHORIZATION_REVOKED",
      "DATABASE_UNAVAILABLE",
      "FAILED_JOBS",
    ]);
  });

  it("reports action required for database failure and R2 usage warning", () => {
    expect(
      calculateFoundationHealth(
        facts({ databaseAvailable: false, r2UsageWarning: true }),
        NOW,
      ),
    ).toMatchObject({
      state: "Action required",
      warningCodes: ["DATABASE_UNAVAILABLE", "R2_USAGE_WARNING"],
    });
  });

  it.each([
    [799, "normal"],
    [800, "warning"],
    [900, "optional_stopped"],
    [950, "stopped"],
  ] as const)(
    "reports AI spend tier at %i cents without disabling deterministic health",
    (aiMonthlyCents, aiSpendTier) => {
      const result = calculateFoundationHealth(
        facts({ aiMonthlyCents }),
        NOW,
      );

      expect(result.state).toBe("Healthy");
      expect(result.aiSpendTier).toBe(aiSpendTier);
    },
  );

  it("rejects future timestamps and invalid counters instead of masking bad diagnostics", () => {
    expect(() =>
      calculateFoundationHealth(
        facts({ lastSuccessfulSyncAt: new Date(NOW.getTime() + 1) }),
        NOW,
      ),
    ).toThrow("Invalid foundation health facts.");
    expect(() =>
      calculateFoundationHealth(facts({ failedJobCount: -1 }), NOW),
    ).toThrow("Invalid foundation health facts.");
  });

  it("rejects non-allowlisted error categories before API exposure", () => {
    expect(() =>
      calculateFoundationHealth(
        facts({
          safeErrorCode:
            "refresh_token_ciphertext=must-not-leak" as FoundationHealthFacts["safeErrorCode"],
        }),
        NOW,
      ),
    ).toThrow("Invalid foundation health facts.");
  });
});
