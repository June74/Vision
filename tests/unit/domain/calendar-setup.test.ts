import { describe, expect, it } from "vitest";
import {
  CREATE_VISION_CALENDAR_CONFIRMATION,
  transitionCalendarSetup,
  type CalendarSetupState,
} from "../../../src/domain/setup/calendar-setup";

describe("calendar setup state machine", () => {
  const signedOut: CalendarSetupState = { setupVersion: 0, status: "signed_out" };
  const authenticated: CalendarSetupState = { setupVersion: 1, status: "authenticated" };
  const discovering: CalendarSetupState = { setupVersion: 2, status: "discovering" };
  const awaitingChoice: CalendarSetupState = {
    candidates: ["calendar-1"],
    setupVersion: 3,
    status: "awaiting_choice",
  };
  const awaitingConfirmation: CalendarSetupState = {
    setupVersion: 3,
    status: "awaiting_confirmation",
  };
  const creating: CalendarSetupState = { setupVersion: 4, status: "creating" };
  const failed: CalendarSetupState = { setupVersion: 5, status: "failed" };

  it("moves through every named setup state with deterministic version increments", () => {
    const afterSignIn = transitionCalendarSetup(signedOut, { setupVersion: 0, type: "sign-in" });
    const afterDiscovery = transitionCalendarSetup(afterSignIn, {
      setupVersion: 1,
      type: "start-discovery",
    });
    const afterCandidates = transitionCalendarSetup(afterDiscovery, {
      calendarIds: ["calendar-1"],
      setupVersion: 2,
      type: "discovery-complete",
    });
    const afterEmptyDiscovery = transitionCalendarSetup(afterDiscovery, {
      calendarIds: [],
      setupVersion: 2,
      type: "discovery-complete",
    });
    const afterConfirmation = transitionCalendarSetup(afterEmptyDiscovery, {
      phrase: CREATE_VISION_CALENDAR_CONFIRMATION,
      setupVersion: 3,
      type: "confirm-create",
    });
    const afterCreation = transitionCalendarSetup(afterConfirmation, {
      calendarId: "calendar-2",
      setupVersion: 4,
      type: "creation-complete",
    });

    expect([afterSignIn, afterDiscovery, afterCandidates, afterEmptyDiscovery, afterConfirmation, afterCreation]).toEqual([
      authenticated,
      discovering,
      awaitingChoice,
      { setupVersion: 3, status: "awaiting_confirmation" },
      creating,
      { calendarId: "calendar-2", connection: "created", setupVersion: 5, status: "connected" },
    ]);
  });

  it("connects an explicitly selected existing owned calendar without entering creation", () => {
    expect(
      transitionCalendarSetup(awaitingChoice, {
        calendarId: "calendar-1",
        setupVersion: 3,
        type: "select-existing-calendar",
      }),
    ).toEqual({
      calendarId: "calendar-1",
      connection: "existing",
      setupVersion: 4,
      status: "connected",
    });
  });

  it("rejects exact creation confirmation when discovery found an owned calendar to connect", () => {
    expect(() =>
      transitionCalendarSetup(awaitingChoice, {
        phrase: CREATE_VISION_CALENDAR_CONFIRMATION,
        setupVersion: 3,
        type: "confirm-create",
      }),
    ).toThrow("INVALID_SETUP_TRANSITION");
  });

  it("rejects a confirmation phrase that is not exact", () => {
    expect(() =>
      transitionCalendarSetup(awaitingConfirmation, {
        phrase: "create vision calendar",
        setupVersion: 3,
        type: "confirm-create",
      }),
    ).toThrow("EXACT_CONFIRMATION_REQUIRED");
  });

  it("rejects duplicate confirmation after creation has started", () => {
    expect(() =>
      transitionCalendarSetup(creating, {
        phrase: CREATE_VISION_CALENDAR_CONFIRMATION,
        setupVersion: 4,
        type: "confirm-create",
      }),
    ).toThrow("INVALID_SETUP_TRANSITION");
  });

  it("rejects any stale or duplicate setup command safely", () => {
    expect(() =>
      transitionCalendarSetup(authenticated, { setupVersion: 0, type: "start-discovery" }),
    ).toThrow("STALE_SETUP_VERSION");
  });

  it("moves a failed operation to failed and permits an explicit retry", () => {
    const afterFailure = transitionCalendarSetup(creating, { setupVersion: 4, type: "fail" });
    expect(afterFailure).toEqual(failed);
    expect(transitionCalendarSetup(failed, { setupVersion: 5, type: "retry" })).toEqual({
      setupVersion: 6,
      status: "discovering",
    });
  });

  it("accepts sign-out from every non-signed-out state with an exact current version", () => {
    const states: CalendarSetupState[] = [
      authenticated,
      discovering,
      awaitingChoice,
      awaitingConfirmation,
      creating,
      { calendarId: "calendar-1", connection: "existing", setupVersion: 5, status: "connected" },
      failed,
    ];

    expect(states.map((state) => transitionCalendarSetup(state, { setupVersion: state.setupVersion, type: "sign-out" }))).toEqual(
      states.map((state) => ({ setupVersion: state.setupVersion + 1, status: "signed_out" })),
    );
  });

  it("rejects a hostile non-object command with the safe stale-version error", () => {
    expect(() => transitionCalendarSetup(authenticated, null as unknown as never)).toThrow(
      "STALE_SETUP_VERSION",
    );
  });

  it("rejects a hostile unknown setup state with the safe stale-version error", () => {
    expect(() =>
      transitionCalendarSetup({ setupVersion: 1, status: "unknown" } as unknown as CalendarSetupState, {
        setupVersion: 1,
        type: "sign-in",
      }),
    ).toThrow("STALE_SETUP_VERSION");
  });

  it("rejects malformed calendar IDs without exposing a runtime type error", () => {
    expect(() =>
      transitionCalendarSetup(discovering, {
        calendarIds: null as unknown as string[],
        setupVersion: 2,
        type: "discovery-complete",
      }),
    ).toThrow("STALE_SETUP_VERSION");
  });

  it("rejects an unknown command type before the state transition table", () => {
    expect(() =>
      transitionCalendarSetup(authenticated, { setupVersion: 1, type: "unknown-command" } as never),
    ).toThrow("STALE_SETUP_VERSION");
  });

  it("rejects an accessor-backed command without invoking the accessor or leaking its value", () => {
    const hostileCommand = Object.defineProperty({ setupVersion: 1 }, "type", {
      get: () => {
        throw new Error("hostile command accessor");
      },
    });

    expect(() => transitionCalendarSetup(authenticated, hostileCommand as never)).toThrow(
      "STALE_SETUP_VERSION",
    );
  });

  it("rejects a proxy-backed command when descriptor lookup is hostile", () => {
    const hostileCommand = new Proxy({ setupVersion: 1, type: "sign-in" }, {
      getOwnPropertyDescriptor: () => {
        throw new Error("hostile descriptor trap");
      },
    });

    expect(() => transitionCalendarSetup(authenticated, hostileCommand as never)).toThrow(
      "STALE_SETUP_VERSION",
    );
  });

  it("rejects an otherwise valid command at the maximum safe setup version", () => {
    const maximumVersionState: CalendarSetupState = {
      setupVersion: Number.MAX_SAFE_INTEGER,
      status: "authenticated",
    };

    expect(() =>
      transitionCalendarSetup(maximumVersionState, {
        setupVersion: Number.MAX_SAFE_INTEGER,
        type: "start-discovery",
      }),
    ).toThrow("STALE_SETUP_VERSION");
  });

  it("converts a throwing setup-state getter into the constant safe error", () => {
    const hostileState = Object.defineProperty({ status: "authenticated" }, "setupVersion", {
      get: () => {
        throw new Error("hostile state getter");
      },
    });

    expect(() => transitionCalendarSetup(hostileState as never, { setupVersion: 1, type: "start-discovery" })).toThrow(
      "STALE_SETUP_VERSION",
    );
  });

  it("uses a command snapshot when a proxy get trap throws after descriptor validation", () => {
    const command = new Proxy({ setupVersion: 0, type: "sign-in" }, {
      get: () => {
        throw new Error("hostile post-validation get trap");
      },
    });

    expect(transitionCalendarSetup(signedOut, command as never)).toEqual({
      setupVersion: 1,
      status: "authenticated",
    });
  });

  it("uses the extracted command snapshot despite a mutation after descriptor extraction", () => {
    const target = { setupVersion: 0, type: "sign-in" };
    const command = new Proxy(target, {
      getOwnPropertyDescriptor: (value, key) => {
        const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
        if (key === "type") {
          value.type = "start-discovery";
        }
        return descriptor;
      },
    });

    expect(transitionCalendarSetup(signedOut, command as never)).toEqual({
      setupVersion: 1,
      status: "authenticated",
    });
  });

  it("converts a proxy-backed discovery ID array into the constant safe error", () => {
    const ids = new Proxy(["calendar-1"], { ownKeys: () => { throw new Error("hostile nested keys"); } });
    expect(() => transitionCalendarSetup(discovering, { calendarIds: ids as never, setupVersion: 2, type: "discovery-complete" })).toThrow("STALE_SETUP_VERSION");
  });

  it("converts a proxy-backed candidate ID array into the constant safe error", () => {
    const ids = new Proxy(["calendar-1"], { getOwnPropertyDescriptor: () => { throw new Error("hostile nested descriptor"); } });
    expect(() => transitionCalendarSetup({ candidates: ids as never, setupVersion: 3, status: "awaiting_choice" }, { setupVersion: 3, type: "sign-out" })).toThrow("STALE_SETUP_VERSION");
  });
});
