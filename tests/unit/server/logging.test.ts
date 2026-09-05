import { describe, expect, it, vi } from "vitest";
import { logEvent } from "../../../src/server/logging";
import { AUTH_DIAGNOSTIC_STAGES } from "../../../src/server/auth/diagnostics";

describe("logEvent", () => {
  it.each([
    "callback_recovery_token_missing",
    "callback_recovery_token_subject_mismatch",
    "callback_recovery_token_version_mismatch",
    "callback_recovery_token_timestamp_mismatch",
    "callback_recovery_setup_subject_mismatch",
    "callback_recovery_connection_missing",
    "callback_recovery_connection_subject_mismatch",
    "callback_recovery_connection_summary_mismatch",
    "callback_recovery_connection_role_mismatch",
    "callback_recovery_checkpoint_missing",
    "callback_recovery_maintenance_missing",
    "callback_recovery_maintenance_setup_version_mismatch",
    "callback_recovery_maintenance_checkpoint_version_mismatch",
    "callback_recovery_topology_unclassified",
    "callback_recovery_connected_marker_present",
    "callback_recovery_authorization_marker_version_mismatch",
    "callback_recovery_authorization_marker_category_mismatch",
    "callback_recovery_authorization_marker_timestamp_mismatch",
    "callback_recovery_authorization_token_not_newer",
  ])("admits the approved recovery predicate stage %s", (diagnosticStage) => {
    const logger = vi.fn();
    const event = {
      requestId: "req_1", action: "auth.callback", outcome: "failed",
      errorCategory: "authorization_recovery_failed", diagnosticStage,
    };
    logEvent(logger, event);
    expect(logger).toHaveBeenCalledExactlyOnceWith(event);
  });

  it.each(AUTH_DIAGNOSTIC_STAGES)("accepts only the authored diagnostic stage %s", (diagnosticStage) => {
    const logger = vi.fn();
    const event = { requestId: "req_1", action: "auth.callback", outcome: "failed", diagnosticStage };
    logEvent(logger, event);
    expect(logger).toHaveBeenCalledExactlyOnceWith(event);
  });

  it.each([
    "PRIVATE_PROVIDER_DETAIL", "<script>private</script>", "", null, {},
    "callback_recovery_unclassified", "callback_recovery_PRIVATE_PROVIDER_DETAIL",
    "token_missing", "__proto__", "constructor", { reason: "token_missing" },
  ])(
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
