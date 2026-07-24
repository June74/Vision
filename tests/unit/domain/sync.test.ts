import { describe, expect, it } from "vitest";
import { ProviderEventChangeSchema } from "../../../src/domain/sync/change";
import { SyncCheckpointSchema as CheckpointSchema } from "../../../src/domain/sync/checkpoint";

describe("provider-neutral synchronization contracts", () => {
  it("accepts an explicit deletion without protected event content", () => {
    expect(
      ProviderEventChangeSchema.safeParse({
        type: "delete",
        target: {
          sourceCalendarId: "calendar_1",
          sourceEventId: "event_1",
          sourceSystem: "google-calendar",
        },
        recurrence: { kind: "occurrence", masterEventId: "series_1", originalStartAt: "2026-07-24T14:00:00.000Z" },
      }).success,
    ).toBe(true);
  });

  it("rejects protected text on a deletion", () => {
    expect(
      ProviderEventChangeSchema.safeParse({
        type: "delete",
        target: {
          sourceCalendarId: "calendar_1",
          sourceEventId: "event_1",
          sourceSystem: "google-calendar",
        },
        recurrence: { kind: "single" },
        protected: { title: "must not persist" },
      }).success,
    ).toBe(false);
  });

  it("keeps sync checkpoints versioned and free of provider-specific structure", () => {
    const checkpoint = {
      calendarId: "calendar_1",
      committedAt: "2026-07-24T15:00:00.000Z",
      syncToken: "opaque-sync-token",
      version: 3,
    };

    expect(CheckpointSchema.safeParse(checkpoint).success).toBe(true);
    expect(CheckpointSchema.safeParse({ ...checkpoint, provider: "google" }).success).toBe(false);
  });
});
