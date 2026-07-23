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

  it("rejects a symbol audit field before calling the logger", () => {
    const logger = vi.fn();
    const event = { requestId: "req_1", action: "calendar.sync", outcome: "failed" };
    Object.defineProperty(event, Symbol("description"), { value: "private text" });

    expect(() => logEvent(logger, event)).toThrow("Unsupported audit field");
    expect(logger).not.toHaveBeenCalled();
  });

  it("rejects a non-enumerable audit field before calling the logger", () => {
    const logger = vi.fn();
    const event = { requestId: "req_1", action: "calendar.sync", outcome: "failed" };
    Object.defineProperty(event, "description", { value: "private text" });

    expect(() => logEvent(logger, event)).toThrow("Unsupported audit field");
    expect(logger).not.toHaveBeenCalled();
  });

  it("rejects an audit event with an inherited prototype", () => {
    const logger = vi.fn();
    const event = Object.assign(Object.create({ description: "private text" }), {
      requestId: "req_1",
      action: "calendar.sync",
      outcome: "failed",
    });

    expect(() => logEvent(logger, event)).toThrow("Unsupported audit event");
    expect(logger).not.toHaveBeenCalled();
  });

  it("rejects free-form entity values", () => {
    const logger = vi.fn();

    expect(() =>
      logEvent(logger, {
        requestId: "req_1",
        action: "calendar.sync",
        outcome: "failed",
        entityId: "Quarterly planning title",
      }),
    ).toThrow();
    expect(logger).not.toHaveBeenCalled();
  });

  it("accepts a standard event with opaque UUID entity IDs", () => {
    const logger = vi.fn();
    const event = {
      requestId: "req_1",
      action: "calendar.sync",
      outcome: "failed",
      entityId: "550e8400-e29b-41d4-a716-446655440000",
      entityIds: ["c56a4180-65aa-42ec-a945-5fd21dec0538"],
    };

    logEvent(logger, event);

    expect(logger).toHaveBeenCalledWith(event);
  });
});
