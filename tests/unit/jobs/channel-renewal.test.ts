import { describe, expect, it, vi } from "vitest";
import {
  renewExpiringChannels,
  type ChannelLifecycleDependencies,
  type RenewalCandidate,
} from "../../../src/jobs/renew-google-channels";

const NOW = new Date("2026-07-24T16:00:00.000Z");
const CANDIDATE: RenewalCandidate = {
  ownerId: "owner-1",
  calendarId: "calendar-1",
  connectionVersion: 4,
  checkpointVersion: 1,
  previous: {
    rowId: "old-row",
    channelId: "old-channel",
    resourceId: "old-resource",
    expiresAt: new Date(NOW.getTime() + 30 * 60_000),
  },
};

function dependencies(
  overrides: Partial<ChannelLifecycleDependencies> = {},
): ChannelLifecycleDependencies {
  return {
    repository: {
      listRenewalCandidates: vi.fn(async () => [CANDIDATE]),
      preRegister: vi.fn(async () => undefined),
      activate: vi.fn(async () => true),
      retire: vi.fn(async () => true),
      recordFailure: vi.fn(async () => undefined),
      listSupersededChannels: vi.fn(async () => []),
      markCleanupRequired: vi.fn(async () => undefined),
    },
    provider: {
      watch: vi.fn(async () => ({
        resourceId: "new-resource",
        expiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60_000),
      })),
      stop: vi.fn(async () => undefined),
    },
    createChannelId: () => "new-channel-opaque-id",
    createChannelToken: () => "new-token-with-at-least-32-random-bytes",
    createLeaseId: () => "lease-opaque-id",
    hashToken: vi.fn(async () => "A".repeat(43)),
    encryptToken: vi.fn(async () => new Uint8Array([1, 2, 3])),
    ...overrides,
  };
}

describe("Google channel renewal", () => {
  it("pre-registers the token before watch and activates before stopping the old channel", async () => {
    const order: string[] = [];
    const deps = dependencies();
    vi.mocked(deps.repository.preRegister).mockImplementation(async () => {
      order.push("pre-register");
    });
    vi.mocked(deps.provider.watch).mockImplementation(async () => {
      order.push("watch");
      return {
        resourceId: "new-resource",
        expiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60_000),
      };
    });
    vi.mocked(deps.repository.activate).mockImplementation(async () => {
      order.push("activate");
      return true;
    });
    vi.mocked(deps.provider.stop).mockImplementation(async () => {
      order.push("stop");
    });
    vi.mocked(deps.repository.retire).mockImplementation(async () => {
      order.push("retire");
      return true;
    });

    await renewExpiringChannels(NOW, deps);

    expect(order).toEqual([
      "pre-register",
      "watch",
      "activate",
      "stop",
      "retire",
    ]);
  });

  it("preserves the old active channel when watch fails", async () => {
    const deps = dependencies({
      provider: {
        watch: vi.fn(async () => {
          throw new Error("safe synthetic provider failure");
        }),
        stop: vi.fn(async () => undefined),
      },
    });

    await renewExpiringChannels(NOW, deps);

    expect(deps.repository.activate).not.toHaveBeenCalled();
    expect(deps.provider.stop).not.toHaveBeenCalled();
    expect(deps.repository.retire).not.toHaveBeenCalled();
    expect(deps.repository.recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "owner-1",
        calendarId: "calendar-1",
        rowId: "channel_new-channel-opaque-id",
        leaseId: "lease-opaque-id",
        expectedCheckpointVersion: 1,
        now: NOW,
      }),
    );
  });

  it("keeps the replacement active when stopping the old channel fails", async () => {
    const deps = dependencies({
      provider: {
        watch: vi.fn(async () => ({
          resourceId: "new-resource",
          expiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60_000),
        })),
        stop: vi.fn(async () => {
          throw new Error("safe synthetic stop failure");
        }),
      },
    });

    await renewExpiringChannels(NOW, deps);

    expect(deps.repository.activate).toHaveBeenCalledOnce();
    expect(deps.repository.retire).not.toHaveBeenCalled();
    expect(deps.repository.recordFailure).not.toHaveBeenCalled();
    expect(deps.repository.markCleanupRequired).toHaveBeenCalledWith(
      "old-row",
      NOW,
    );
  });

  it("stops the newly watched resource when database activation loses its race", async () => {
    const deps = dependencies();
    vi.mocked(deps.repository.activate).mockResolvedValue(false);

    await renewExpiringChannels(NOW, deps);

    expect(deps.provider.stop).toHaveBeenCalledWith({
      channelId: "new-channel-opaque-id",
      resourceId: "new-resource",
    });
    expect(deps.repository.retire).not.toHaveBeenCalled();
  });

  it("retries durable cleanup for superseded channels", async () => {
    const deps = dependencies({
      repository: {
        ...dependencies().repository,
        listRenewalCandidates: vi.fn(async () => []),
        listSupersededChannels: vi.fn(async () => [
          {
            rowId: "superseded-row",
            channelId: "superseded-channel",
            resourceId: "superseded-resource",
            expiresAt: new Date(NOW.getTime() + 1),
          },
        ]),
      },
    });

    await renewExpiringChannels(NOW, deps);

    expect(deps.provider.stop).toHaveBeenCalledWith({
      channelId: "superseded-channel",
      resourceId: "superseded-resource",
    });
    expect(deps.repository.retire).toHaveBeenCalledWith(
      "superseded-row",
      NOW,
    );
  });

  it("continues remaining calendars before reporting an unexpected candidate failure", async () => {
    const failure = new Error("safe synthetic database failure");
    const deps = dependencies();
    vi.mocked(deps.repository.listRenewalCandidates).mockResolvedValue([
      CANDIDATE,
      { ...CANDIDATE, calendarId: "calendar-2" },
    ]);
    vi.mocked(deps.repository.preRegister)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);

    await expect(renewExpiringChannels(NOW, deps)).rejects.toBe(failure);

    expect(deps.repository.preRegister).toHaveBeenCalledTimes(2);
    expect(deps.provider.watch).toHaveBeenCalledOnce();
  });
});
