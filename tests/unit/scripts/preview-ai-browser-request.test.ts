import { describe, expect, it, vi } from "vitest";
import {
  executeOneBrowserScopedAiRequest,
  type PreviewAiBrowserRequestDependencies,
} from "../../../scripts/validate-preview-ai-browser-request";

const APPROVAL_AT = new Date("2026-07-31T18:00:00.000Z");
const STARTED_AT = new Date("2026-07-31T18:00:00.001Z");
const COMPLETED_AT = new Date("2026-07-31T18:00:01.000Z");
const EVIDENCE_AT = new Date("2026-07-31T18:02:00.000Z");
const INVALID = "Preview AI browser request is invalid.";

type SafeResponse = Pick<Response, "ok" | "arrayBuffer">;

function response(ok: boolean, drain = vi.fn(async () => new ArrayBuffer(0))): SafeResponse {
  return { ok, arrayBuffer: drain };
}

function requestFactory() {
  return vi.fn(async () => ({
    input: "/api/ai/category-proposals",
    init: {
      method: "POST",
      headers: { "x-private-state": "private-state-marker" },
      body: "private-body-marker",
    },
  }));
}

function dependencies(input?: {
  readonly fetch?: PreviewAiBrowserRequestDependencies["fetch"];
  readonly pageStates?: readonly boolean[];
  readonly utc?: readonly Date[];
  readonly monotonicNow?: () => number;
  readonly setTimer?: PreviewAiBrowserRequestDependencies["setTimer"];
  readonly clearTimer?: PreviewAiBrowserRequestDependencies["clearTimer"];
  readonly createAbortController?: PreviewAiBrowserRequestDependencies["createAbortController"];
}): PreviewAiBrowserRequestDependencies {
  const utc = [...(input?.utc ?? [STARTED_AT, COMPLETED_AT])];
  const pageStates = [...(input?.pageStates ?? [true, true])];
  return {
    isPageContext: vi.fn(() => pageStates.shift() ?? true),
    nowUtc: vi.fn(() => new Date((utc.shift() ?? COMPLETED_AT).getTime())),
    monotonicNow: input?.monotonicNow ?? vi.fn(() => 0),
    fetch:
      input?.fetch ??
      vi.fn(async () => response(true) as Response),
    createAbortController:
      input?.createAbortController ?? (() => new AbortController()),
    setTimer: input?.setTimer ?? vi.fn(() => 17),
    clearTimer: input?.clearTimer ?? vi.fn(),
  };
}

async function execute(
  factory = requestFactory(),
  deps = dependencies(),
) {
  return executeOneBrowserScopedAiRequest(
    factory,
    { approvalAt: APPROVAL_AT, evidenceScheduledAt: EVIDENCE_AT },
    deps,
  );
}

describe("preview AI browser request", () => {
  it("calls the private factory and fetch once, drains bytes, clears the timer, and returns only the safe success shape", async () => {
    const drain = vi.fn(async () => new TextEncoder().encode("discarded").buffer);
    const fetchRequest = vi.fn<PreviewAiBrowserRequestDependencies["fetch"]>(
      async () => response(true, drain) as Response,
    );
    const clearTimer = vi.fn();
    const setTimer = vi.fn<PreviewAiBrowserRequestDependencies["setTimer"]>(
      () => 41,
    );
    const factory = requestFactory();
    const deps = dependencies({ fetch: fetchRequest, clearTimer, setTimer });

    const result = await execute(factory, deps);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(fetchRequest).toHaveBeenCalledTimes(1);
    expect(fetchRequest.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(drain).toHaveBeenCalledTimes(1);
    expect(setTimer).toHaveBeenCalledTimes(1);
    expect(setTimer.mock.calls[0]?.[1]).toBe(35_000);
    expect(clearTimer).toHaveBeenCalledTimes(1);
    expect(clearTimer).toHaveBeenCalledWith(41);
    expect(result).toEqual({
      startedAt: "2026-07-31T18:00:00.001Z",
      completedAt: "2026-07-31T18:00:01.000Z",
      succeeded: true,
      statusClass: "success",
    });
    expect(Object.keys(result).sort()).toEqual([
      "completedAt",
      "startedAt",
      "statusClass",
      "succeeded",
    ]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("classifies a drained non-success response as an HTTP failure", async () => {
    const drain = vi.fn(async () => new ArrayBuffer(0));
    const fetchRequest = vi.fn(async () => response(false, drain) as Response);

    const result = await execute(requestFactory(), dependencies({ fetch: fetchRequest }));

    expect(drain).toHaveBeenCalledTimes(1);
    expect(result.succeeded).toBe(false);
    expect(result.statusClass).toBe("http_failure");
  });

  it("never retries a network or response-drain failure", async () => {
    for (const fetchRequest of [
      vi.fn(async () => {
        throw new Error("private-network-detail");
      }),
      vi.fn(async () =>
        response(true, vi.fn(async () => {
          throw new Error("private-response-detail");
        })) as Response),
    ]) {
      const result = await execute(
        requestFactory(),
        dependencies({ fetch: fetchRequest }),
      );
      expect(fetchRequest).toHaveBeenCalledTimes(1);
      expect(result.succeeded).toBe(false);
      expect(result.statusClass).toBe("network_failure");
      expect(JSON.stringify(result)).not.toMatch(/private-/u);
    }
  });

  it("aborts at 35 monotonic seconds, clears the timer, and does not retry", async () => {
    let monotonic = 10_000;
    let timerCallback: (() => void) | undefined;
    const controller = new AbortController();
    const abort = vi.spyOn(controller, "abort");
    const clearTimer = vi.fn();
    const fetchRequest = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("private-abort-detail", "AbortError"));
          });
        }),
    );
    const deps = dependencies({
      fetch: fetchRequest,
      monotonicNow: () => monotonic,
      createAbortController: () => controller,
      setTimer: (callback, delayMilliseconds) => {
        expect(delayMilliseconds).toBe(35_000);
        timerCallback = callback;
        return 73;
      },
      clearTimer,
    });

    const pending = execute(requestFactory(), deps);
    await vi.waitFor(() => expect(fetchRequest).toHaveBeenCalledTimes(1));
    monotonic = 45_000;
    timerCallback?.();
    const result = await pending;

    expect(abort).toHaveBeenCalledTimes(1);
    expect(fetchRequest).toHaveBeenCalledTimes(1);
    expect(clearTimer).toHaveBeenCalledWith(73);
    expect(result.succeeded).toBe(false);
    expect(result.statusClass).toBe("aborted");
  });

  it("accepts a finite fractional monotonic clock and deadline", async () => {
    const setTimer = vi.fn<PreviewAiBrowserRequestDependencies["setTimer"]>(
      () => 81,
    );

    await expect(
      execute(
        requestFactory(),
        dependencies({ monotonicNow: () => 10_000.25, setTimer }),
      ),
    ).resolves.toMatchObject({ succeeded: true, statusClass: "success" });
    expect(setTimer).toHaveBeenCalledWith(expect.any(Function), 35_000);
  });

  it("reports aborted when fetch fulfills after the abort deadline", async () => {
    let monotonic = 0;
    let timerCallback: (() => void) | undefined;
    let fulfillFetch: ((value: Response) => void) | undefined;
    const controller = new AbortController();
    const fetchRequest = vi.fn<PreviewAiBrowserRequestDependencies["fetch"]>(
      () =>
        new Promise<Response>((resolve) => {
          fulfillFetch = resolve;
        }),
    );
    const pending = execute(
      requestFactory(),
      dependencies({
        fetch: fetchRequest,
        monotonicNow: () => monotonic,
        createAbortController: () => controller,
        setTimer: (callback) => {
          timerCallback = callback;
          return 91;
        },
      }),
    );
    await vi.waitFor(() => expect(fetchRequest).toHaveBeenCalledTimes(1));

    monotonic = 35_000;
    timerCallback?.();
    fulfillFetch?.(response(true) as Response);
    const result = await pending;

    expect(controller.signal.aborted).toBe(true);
    expect(fetchRequest).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ succeeded: false, statusClass: "aborted" });
  });

  it("classifies a page disconnect without retrying or exposing page details", async () => {
    const fetchRequest = vi.fn(async () => response(true) as Response);
    const result = await execute(
      requestFactory(),
      dependencies({ fetch: fetchRequest, pageStates: [true, false] }),
    );

    expect(fetchRequest).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      succeeded: false,
      statusClass: "page_disconnected",
    });
  });

  it("refuses to invoke the private factory outside page context", async () => {
    const factory = requestFactory();
    const fetchRequest = vi.fn(async () => response(true) as Response);

    await expect(
      execute(factory, dependencies({ fetch: fetchRequest, pageStates: [false] })),
    ).rejects.toThrow(INVALID);
    expect(factory).not.toHaveBeenCalled();
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it.each([
    ["one millisecond", new Date(APPROVAL_AT.getTime() + 1)],
    ["exactly sixty seconds", new Date(APPROVAL_AT.getTime() + 60_000)],
  ])("accepts request start %s after approval", async (_label, startedAt) => {
    const result = await execute(
      requestFactory(),
      dependencies({ utc: [startedAt, new Date(startedAt.getTime() + 1)] }),
    );
    expect(result.startedAt).toBe(startedAt.toISOString());
  });

  it.each([
    ["equal to approval", new Date(APPROVAL_AT.getTime())],
    ["sixty seconds plus one millisecond", new Date(APPROVAL_AT.getTime() + 60_001)],
  ])("rejects request start %s before private work", async (_label, startedAt) => {
    const factory = requestFactory();
    const fetchRequest = vi.fn(async () => response(true) as Response);
    await expect(
      execute(
        factory,
        dependencies({ fetch: fetchRequest, utc: [startedAt, COMPLETED_AT] }),
      ),
    ).rejects.toThrow(INVALID);
    expect(factory).not.toHaveBeenCalled();
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it("accepts equal start and completion but rejects completion at the evidence instant", async () => {
    await expect(
      execute(
        requestFactory(),
        dependencies({ utc: [STARTED_AT, STARTED_AT] }),
      ),
    ).resolves.toMatchObject({
      startedAt: STARTED_AT.toISOString(),
      completedAt: STARTED_AT.toISOString(),
    });

    await expect(
      execute(
        requestFactory(),
        dependencies({ utc: [STARTED_AT, EVIDENCE_AT] }),
      ),
    ).rejects.toThrow(INVALID);
  });

  it("returns and throws no protected request fields or provider error details", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const factory = requestFactory();
    const fetchRequest = vi.fn(async () => {
      throw new Error("private-provider-marker");
    });

    const result = await execute(factory, dependencies({ fetch: fetchRequest }));

    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(
      /private-state-marker|private-body-marker|private-provider-marker|category-proposals/u,
    );
    log.mockRestore();
    error.mockRestore();

    const invalidFactory = requestFactory();
    await expect(
      execute(
        invalidFactory,
        dependencies({ utc: [new Date("invalid")] }),
      ),
    ).rejects.toThrow(INVALID);
  });
});
