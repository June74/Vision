/** Executes the sole live-acceptance AI request without exporting private input. */

const INVALID = "Preview AI browser request is invalid.";
const ABORT_AFTER_MILLISECONDS = 35_000;
const APPROVAL_LIFETIME_MILLISECONDS = 60_000;

export type PreviewAiBrowserStatusClass =
  | "success"
  | "http_failure"
  | "aborted"
  | "network_failure"
  | "page_disconnected";

export interface PreviewAiBrowserSafeResult {
  readonly startedAt: string;
  readonly completedAt: string;
  readonly succeeded: boolean;
  readonly statusClass: PreviewAiBrowserStatusClass;
}

export interface PreviewAiBrowserRequestDependencies {
  readonly isPageContext: () => boolean;
  readonly nowUtc: () => Date;
  readonly monotonicNow: () => number;
  readonly fetch: (
    input: RequestInfo | URL,
    init: RequestInit,
  ) => Promise<Response>;
  readonly createAbortController: () => AbortController;
  readonly setTimer: (
    callback: () => void,
    delayMilliseconds: number,
  ) => unknown;
  readonly clearTimer: (handle: unknown) => void;
}

/**
 * Runs one private page-scoped request and returns only bounded transport
 * evidence. The private request value is never returned, serialized, or logged.
 */
export async function executeOneBrowserScopedAiRequest(
  privateRequestFactory: () => Promise<{
    readonly input: RequestInfo | URL;
    readonly init: RequestInit;
  }>,
  timing: {
    readonly approvalAt: Date;
    readonly evidenceScheduledAt: Date;
  },
  dependencies: PreviewAiBrowserRequestDependencies,
): Promise<PreviewAiBrowserSafeResult> {
  const approvalAt = instant(timing.approvalAt);
  const evidenceScheduledAt = instant(timing.evidenceScheduledAt);
  const startedAt = dependencyInstant(dependencies.nowUtc);
  if (
    startedAt <= approvalAt ||
    startedAt - approvalAt > APPROVAL_LIFETIME_MILLISECONDS ||
    startedAt >= evidenceScheduledAt ||
    !pageContextAvailable(dependencies.isPageContext)
  ) {
    fail();
  }

  let controller: AbortController;
  let monotonicDeadline: number;
  let timerHandle: unknown;
  let timerArmed = false;
  let aborted = false;
  try {
    controller = dependencies.createAbortController();
    const monotonicStart = finiteMonotonic(dependencies.monotonicNow());
    monotonicDeadline = monotonicStart + ABORT_AFTER_MILLISECONDS;
    if (!Number.isFinite(monotonicDeadline)) fail();

    /** Aborts at the fixed monotonic deadline, rearming an early timer. */
    const abortAtDeadline = (): void => {
      let current: number;
      try {
        current = finiteMonotonic(dependencies.monotonicNow());
        if (current < monotonicDeadline) {
          timerHandle = dependencies.setTimer(
            abortAtDeadline,
            monotonicDeadline - current,
          );
          return;
        }
      } catch {
        // A broken page clock is uncertain, so abort without exposing details.
      }
      aborted = true;
      try {
        controller.abort();
      } catch {
        // The closed result below remains an abort even if the adapter fails.
      }
    };

    timerHandle = dependencies.setTimer(
      abortAtDeadline,
      ABORT_AFTER_MILLISECONDS,
    );
    timerArmed = true;
  } catch {
    fail();
  }

  let statusClass: PreviewAiBrowserStatusClass;
  try {
    const request = await privateRequestFactory();
    const response = await dependencies.fetch(request.input, {
      ...request.init,
      signal: controller.signal,
    });
    await response.arrayBuffer();
    statusClass = aborted || controller.signal.aborted
      ? "aborted"
      : pageContextAvailable(dependencies.isPageContext)
        ? response.ok
          ? "success"
          : "http_failure"
        : "page_disconnected";
  } catch {
    statusClass = !pageContextAvailable(dependencies.isPageContext)
      ? "page_disconnected"
      : aborted || controller.signal.aborted
        ? "aborted"
        : "network_failure";
  } finally {
    if (timerArmed) {
      try {
        dependencies.clearTimer(timerHandle);
      } catch {
        fail();
      }
    }
  }

  const completedAt = dependencyInstant(dependencies.nowUtc);
  if (completedAt < startedAt || completedAt >= evidenceScheduledAt) fail();

  return Object.freeze({
    startedAt: canonicalInstant(startedAt),
    completedAt: canonicalInstant(completedAt),
    succeeded: statusClass === "success",
    statusClass,
  });
}

/** Reads one valid Date without invoking overridden instance methods. */
function instant(value: Date): number {
  try {
    const milliseconds = Date.prototype.getTime.call(value);
    if (Number.isFinite(milliseconds)) return milliseconds;
  } catch {
    // Fall through to the sole safe validation error.
  }
  fail();
}

/** Normalizes a UTC-clock adapter failure to the sole safe error. */
function dependencyInstant(nowUtc: () => Date): number {
  try {
    return instant(nowUtc());
  } catch {
    fail();
  }
}

/** Requires a finite nonnegative monotonic millisecond value. */
function finiteMonotonic(value: number): number {
  if (!Number.isFinite(value) || value < 0) fail();
  return value;
}

/** Reads page liveness without propagating browser adapter details. */
function pageContextAvailable(check: () => boolean): boolean {
  try {
    return check() === true;
  } catch {
    return false;
  }
}

/** Produces the one canonical UTC representation admitted by the contract. */
function canonicalInstant(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

/** Throws the sole privacy-safe browser-request validation error. */
function fail(): never {
  throw new Error(INVALID);
}
