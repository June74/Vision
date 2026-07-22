import { describe, expect, it, vi } from "vitest";
import { logEvent } from "../../../src/server/logging";

describe("logEvent", () => {
  it("rejects sensitive fields before calling the logger", () => {
    const logger = vi.fn();

    expect(() =>
      logEvent(
        logger,
        {
          requestId: "req_1",
          action: "calendar.sync",
          outcome: "failed",
          description: "private text",
        } as never,
      ),
    ).toThrow("Unsupported audit field");

    expect(logger).not.toHaveBeenCalled();
  });
});
