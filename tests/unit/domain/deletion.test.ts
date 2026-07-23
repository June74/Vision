import { describe, expect, it } from "vitest";
import {
  RECOVERY_WINDOW_MS,
  canRestore,
  isPurgeDue,
  markDeleted,
} from "../../../src/domain/lifecycle/deletion";

describe("recoverable deletion lifecycle", () => {
  const deletedAt = new Date("2026-07-23T12:00:00.000Z");
  const purgeAfter = new Date(deletedAt.getTime() + RECOVERY_WINDOW_MS);

  it("sets the purge instant to exactly thirty 24-hour days after confirmed deletion", () => {
    expect(markDeleted("node_1", deletedAt, purgeAfter)).toEqual({
      nodeId: "node_1",
      deletedAt,
      purgeAfter,
    });
  });

  it("allows restoration one millisecond before the purge boundary but not at it", () => {
    expect(canRestore({ deletedAt, purgeAfter }, new Date(purgeAfter.getTime() - 1))).toBe(true);
    expect(canRestore({ deletedAt, purgeAfter }, purgeAfter)).toBe(false);
  });

  it("makes permanent purge due exactly at the same boundary", () => {
    expect(isPurgeDue({ deletedAt, purgeAfter }, new Date(purgeAfter.getTime() - 1))).toBe(false);
    expect(isPurgeDue({ deletedAt, purgeAfter }, purgeAfter)).toBe(true);
  });

  it("rejects a recovery record whose purge instant is not exactly thirty days later", () => {
    expect(() =>
      markDeleted("node_1", deletedAt, new Date(purgeAfter.getTime() - 1)),
    ).toThrow("Recovery window must be exactly 30 days.");
  });
});
