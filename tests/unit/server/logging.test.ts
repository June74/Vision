import { describe, expect, it, vi } from "vitest";
import { logEvent } from "../../../src/server/logging";
import { AUTH_DIAGNOSTIC_STAGES } from "../../../src/server/auth/diagnostics";

describe("logEvent", () => {
  it.each(AUTH_DIAGNOSTIC_STAGES)("accepts only the authored diagnostic stage %s", (diagnosticStage) => {
    const logger = vi.fn();
    const event = { requestId: "req_1", action: "auth.callback", outcome: "failed", diagnosticStage };
    logEvent(logger, event);
    expect(logger).toHaveBeenCalledExactlyOnceWith(event);
  });

  it.each(["PRIVATE_PROVIDER_DETAIL", "<script>private</script>", "", null, {}])(
    "rejects a non-category diagnostic value before emission: %j",
    (diagnosticStage) => {
      const logger = vi.fn();
      expect(() => logEvent(logger, {
        requestId: "req_1", action: "auth.callback", outcome: "failed", diagnosticStage,
      })).toThrow();
      expect(logger).not.toHaveBeenCalled();
    },
  );

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
