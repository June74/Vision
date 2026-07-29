import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  DiagnosticEvent,
  DiagnosticRepositoryPort,
} from "../../src/data/repositories/diagnostic-repository";
import type { FoundationHealthFacts } from "../../src/domain/operations/health";
import type { TemporaryPreviewFaultScenario } from "../../src/domain/operations/temporary-preview-fault";
import type { DiagnosticRouteDependencies } from "../../src/server/api/diagnostic-routes";
import type { Env } from "../../src/server/env";
import { createApp } from "../../src/worker";

const SESSION = {
  authenticated: true,
  csrfToken: "test-csrf-token",
  email: "owner@example.com",
  expiresAt: "2026-07-26T00:00:00.000Z",
};
const WORKER_SESSION_ID = "S".repeat(43);
const WORKER_OWNER_ID = "usr_e2e_private_pilot";
const WORKER_NOW = new Date("2026-07-25T15:00:00.000Z");

const CONNECTED_SETUP = {
  actionRequired: false,
  candidates: [],
  connection: {
    calendarId: "vision-calendar",
    connectionKind: "existing",
    providerEtag: "etag",
    timeZone: "America/Chicago",
    verifiedAt: "2026-07-25T12:00:00.000Z",
  },
  setupVersion: 4,
  status: "connected",
};

const HEALTHY_STATUS = {
  status: {
    state: "Healthy",
    authorizationState: "connected",
    lastSuccessfulSyncAt: "2026-07-25T14:55:00.000Z",
    syncDelayMs: 300_000,
    oldestQueuedJobAt: null,
    oldestJobDelayMs: null,
    queueRetryCount: 0,
    failedJobCount: 0,
    channelExpiresAt: "2026-07-27T15:00:00.000Z",
    aiSpendTier: "normal",
    aiMonthlyCents: 214,
    databaseUsageWarning: false,
    r2UsageWarning: false,
    safeErrorCode: null,
    warningCodes: [],
  },
};

const EVENTS = [
  {
    id: "event-school",
    title: "Advanced data systems",
    startsAt: "2026-07-25T14:00:00.000Z",
    endsAt: "2026-07-25T15:15:00.000Z",
    timeZone: "America/Chicago",
    status: "confirmed",
    domain: "school",
    domainState: "inferred",
    categoryProvenance: "model",
  },
  {
    id: "event-unresolved",
    title: "Planning session",
    startsAt: "2026-07-25T17:30:00.000Z",
    endsAt: "2026-07-25T18:00:00.000Z",
    timeZone: "America/Chicago",
    status: "tentative",
    domain: "unresolved",
    domainState: "unresolved",
    categoryProvenance: "system",
  },
];

async function fulfillJson(
  route: Route,
  body: Record<string, unknown>,
  status = 200,
): Promise<void> {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status,
  });
}

async function mockConnectedShell(page: Page): Promise<void> {
  await page.route("**/api/auth/session", (route) =>
    fulfillJson(route, SESSION));
  await page.route("**/api/setup/calendar", (route) =>
    fulfillJson(route, CONNECTED_SETUP));
}

async function mockFoundation(
  page: Page,
  options: {
    readonly events?: readonly Record<string, unknown>[];
    readonly status?: Record<string, unknown>;
  } = {},
): Promise<void> {
  await mockConnectedShell(page);
  await page.route("**/api/diagnostics/status", (route) =>
    fulfillJson(route, options.status ?? HEALTHY_STATUS));
  await page.route("**/api/calendar/events", (route) =>
    fulfillJson(route, { events: options.events ?? EVENTS }));
}

/** Builds the real Worker overlay and owner boundary without opening external capabilities. */
function createTask5WorkerApp() {
  const repository: DiagnosticRepositoryPort = {
    readFoundationFacts: async () =>
      ({
        authorizationState: "connected",
        checkpointStatus: "connected",
        lastSuccessfulSyncAt: new Date(WORKER_NOW.getTime() - 5 * 60_000),
        oldestQueuedJobAt: null,
        queueRetryCount: 0,
        failedJobCount: 0,
        channelExpiresAt: new Date(WORKER_NOW.getTime() + 48 * 60 * 60_000),
        databaseAvailable: true,
        databaseUsageWarning: false,
        r2UsageWarning: false,
        aiMonthlyCents: 214,
        safeErrorCode: null,
      }) as FoundationHealthFacts,
    listEvents: async () => EVENTS as unknown as readonly DiagnosticEvent[],
    correctCategory: async () => undefined,
  };
  const dependencies: DiagnosticRouteDependencies = {
    now: () => WORKER_NOW,
    sessions: {
      findSession: async (sessionId) =>
        sessionId === WORKER_SESSION_ID
          ? {
              ownerId: WORKER_OWNER_ID,
              googleSubject: "google-subject",
              email: "owner@example.test",
              csrfToken: "C".repeat(43),
              expiresAt: new Date(WORKER_NOW.getTime() + 60_000),
            }
          : undefined,
    },
    repositoryForOwner: (ownerId) => {
      if (ownerId !== WORKER_OWNER_ID) {
        throw new Error("E2E owner scope is unavailable.");
      }
      return repository;
    },
  };
  return createApp({
    diagnostic: dependencies,
    createRequestId: () => "req_task5_e2e",
    logger: () => undefined,
  });
}

/** Fulfills a browser GET from the injected Worker response without live network access. */
async function fulfillFromTask5Worker(
  route: Route,
  scenario: TemporaryPreviewFaultScenario,
): Promise<void> {
  const headers = new Headers(route.request().headers());
  headers.set("cookie", `vision_session=${WORKER_SESSION_ID}`);
  const response = await createTask5WorkerApp().fetch(
    new Request(route.request().url(), {
      method: route.request().method(),
      headers,
    }),
    {
      VISION_ENV: "preview",
      PREVIEW_ACCEPTANCE_SCENARIO: scenario,
    } as Env,
  );
  await route.fulfill({
    body: await response.text(),
    headers: Object.fromEntries(response.headers),
    status: response.status,
  });
}

/** Routes the deployed-shape Task 5 reads through the real Worker boundary. */
async function mockTask5Worker(
  page: Page,
  scenario: TemporaryPreviewFaultScenario,
): Promise<void> {
  await mockConnectedShell(page);
  await page.route("**/api/diagnostics/status", (route) =>
    fulfillFromTask5Worker(route, scenario));
  await page.route("**/api/calendar/events", (route) =>
    fulfillFromTask5Worker(route, scenario));
}

test("shows a timezone-aware synchronized event ledger without Google write controls", async ({ page }) => {
  await mockFoundation(page);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Your calendar, at a glance" })).toBeVisible();
  await expect(page.getByText("Advanced data systems", { exact: true })).toBeVisible();
  await expect(page.getByText("9:00 AM")).toBeVisible();
  await expect(page.getByText(/America\/Chicago/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /edit|delete|move|cancel|create event/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /edit|delete|move|cancel|create event/i })).toHaveCount(0);
});

for (const candidate of [
  {
    scenario: "queue_delayed",
    state: "Delayed",
    action: "Refresh in a few minutes to check the latest synchronization.",
  },
  {
    scenario: "job_failed",
    state: "Action required",
    action:
      "Refresh after the next repair run. If this remains, reconnect Google Calendar.",
  },
  {
    scenario: "channel_expired",
    state: "Action required",
    action:
      "Refresh Vision in a few minutes. If this remains, reconnect Google Calendar.",
  },
  {
    scenario: "database_unavailable",
    state: "Action required",
    action:
      "Refresh Vision in a few minutes. If this remains, reconnect Google Calendar.",
  },
  {
    scenario: "r2_upload_failed",
    state: "Healthy",
    action: null,
  },
  {
    scenario: "ai_stopped",
    state: "Healthy",
    action: null,
  },
] as const satisfies readonly {
  readonly scenario: TemporaryPreviewFaultScenario;
  readonly state: "Healthy" | "Delayed" | "Action required";
  readonly action: string | null;
}[]) {
  test(`renders the Task 5 ${candidate.scenario} Worker state with calendar reads intact`, async ({
    page,
  }) => {
    let paidAiRequests = 0;
    await page.route("**/api/ai/**", async (route) => {
      paidAiRequests += 1;
      await route.abort();
    });
    await mockTask5Worker(page, candidate.scenario);

    await page.goto("/");

    const signal = page.getByRole("region", { name: "Foundation signal" });
    await expect(signal.getByText(candidate.state, { exact: true })).toBeVisible();
    await expect(
      page.getByText("Advanced data systems", { exact: true }),
    ).toBeVisible();
    if (candidate.action === null) {
      await expect(signal).not.toContainText(
        /Refresh|Reconnect|Try again|Review Vision/iu,
      );
    } else {
      await expect(signal.getByText(candidate.action)).toBeVisible();
      await expect(signal.getByText("Healthy", { exact: true })).toHaveCount(0);
    }
    if (candidate.scenario === "ai_stopped") {
      await expect(page.getByLabel("AI cost status")).toContainText("AI paused");
      await expect(page.getByLabel("AI cost status")).toContainText(
        "Calendar viewing and category changes still work.",
      );
    }
    await expect(
      page.getByRole("button", {
        name: /edit|delete|move|cancel|create event/iu,
      }),
    ).toHaveCount(0);
    expect(paidAiRequests).toBe(0);
  });
}

test("marks inferred and unresolved categories independently of color", async ({ page }) => {
  await mockFoundation(page);

  await page.goto("/");

  const suggested = page.getByRole("listitem").filter({ hasText: "Advanced data systems" });
  const unresolved = page.getByRole("listitem").filter({ hasText: "Planning session" });
  await expect(suggested.getByText("Suggested school")).toBeVisible();
  await expect(unresolved.getByText("Needs category")).toBeVisible();
});

test("applies a Vision-only explicit correction and preserves it after reload", async ({ page }) => {
  let corrected = false;
  await mockConnectedShell(page);
  await page.route("**/api/diagnostics/status", (route) =>
    fulfillJson(route, HEALTHY_STATUS));
  await page.route("**/api/calendar/events", (route) =>
    fulfillJson(route, {
      events: [{
        ...EVENTS[1],
        domain: corrected ? "work" : "unresolved",
        domainState: corrected ? "confirmed" : "unresolved",
        categoryProvenance: corrected ? "user" : "system",
      }],
    }));
  await page.route("**/api/calendar/events/event-unresolved/category", async (route) => {
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().headers()["x-vision-csrf"]).toBe(SESSION.csrfToken);
    expect(JSON.parse(route.request().postData() ?? "{}")).toEqual({ domain: "work" });
    corrected = true;
    await fulfillJson(route, {
      category: {
        id: "event-unresolved",
        domain: "work",
        domainState: "confirmed",
        categoryProvenance: "user",
        assignedAt: "2026-07-25T15:00:00.000Z",
        version: 4,
      },
    });
  });

  await page.goto("/");
  const item = page.getByRole("listitem").filter({ hasText: "Planning session" });
  await expect(item.getByText("This changes Vision only, not Google Calendar.")).toBeVisible();
  await item.getByRole("combobox", { name: "Category for Planning session" }).selectOption("work");
  await expect(item.getByText("Work · Set by you")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Category saved");

  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "Planning session" }).getByText("Work · Set by you")).toBeVisible();
});

for (const scenario of [
  {
    state: "Delayed",
    summary: "Vision is catching up. Your calendar remains available.",
    action: "Refresh in a few minutes to check the latest synchronization.",
  },
  {
    state: "Action required",
    summary: "Vision needs your attention before synchronization can recover.",
    action: "Refresh after the next repair run. If this remains, reconnect Google Calendar.",
  },
  {
    state: "Disconnected",
    summary: "Google Calendar is not connected to Vision.",
    action: "Reconnect Google Calendar, then refresh Vision.",
  },
]) {
  test(`shows actionable ${scenario.state} foundation status`, async ({ page }) => {
    await mockFoundation(page, {
      status: {
        status: {
          ...HEALTHY_STATUS.status,
          state: scenario.state,
          syncDelayMs: 1_200_000,
          failedJobCount: scenario.state === "Action required" ? 1 : 0,
          authorizationState: scenario.state === "Disconnected" ? "revoked" : "connected",
        },
      },
    });

    if (scenario.state === "Action required") {
      await page.emulateMedia({ reducedMotion: "reduce" });
    }
    await page.goto("/");

    await expect(page.getByText(scenario.state, { exact: true })).toBeVisible();
    await expect(page.getByText(scenario.summary)).toBeVisible();
    await expect(page.getByText(scenario.action)).toBeVisible();
    await expect(page.getByText(/Last synchronized/)).toBeVisible();
    if (scenario.state === "Action required") {
      await expect(page.locator(".desk-surface")).toHaveCSS("animation-name", "none");
    }
  });
}

for (const scenario of [
  {
    name: "authorization failure",
    safeErrorCode: "authorization",
    databaseUsageWarning: false,
    r2UsageWarning: false,
    action: "Reconnect Google Calendar, then refresh Vision.",
  },
  {
    name: "database failure",
    safeErrorCode: "database",
    databaseUsageWarning: false,
    r2UsageWarning: false,
    action: "Try again in a few minutes. If this continues, check Vision's database service.",
  },
  {
    name: "managed-service usage warning",
    safeErrorCode: "quota",
    databaseUsageWarning: true,
    r2UsageWarning: true,
    action: "Review Vision's managed-service usage, then refresh Vision.",
  },
  {
    name: "safe fallback",
    safeErrorCode: null,
    databaseUsageWarning: false,
    r2UsageWarning: false,
    action: "Refresh Vision in a few minutes. If this remains, reconnect Google Calendar.",
  },
]) {
  test(`chooses a concrete safe next action for ${scenario.name}`, async ({ page }) => {
    await mockFoundation(page, {
      status: {
        status: {
          ...HEALTHY_STATUS.status,
          state: "Action required",
          failedJobCount: 0,
          safeErrorCode: scenario.safeErrorCode,
          databaseUsageWarning: scenario.databaseUsageWarning,
          r2UsageWarning: scenario.r2UsageWarning,
        },
      },
    });

    await page.goto("/");

    const signal = page.getByRole("region", { name: "Foundation signal" });
    await expect(signal.getByText(scenario.action)).toBeVisible();
    await expect(signal).not.toContainText(/stack|token|cipher|database_url/i);
  });
}

for (const scenario of [
  {
    tier: "warning",
    cents: 800,
    warning: "AI_BUDGET_WARNING",
    title: "AI budget watch",
    copy: "Vision is using its lower-cost model for eligible work.",
    amount: "$8.00 of $9.50",
  },
  {
    tier: "optional_stopped",
    cents: 900,
    warning: "AI_OPTIONAL_STOPPED",
    title: "AI limited",
    copy: "Optional AI work is paused. Core calendar tools still work.",
    amount: "$9.00 of $9.50",
  },
  {
    tier: "stopped",
    cents: 950,
    warning: "AI_BUDGET_STOPPED",
    title: "AI paused",
    copy: "Calendar viewing and category changes still work.",
    amount: "$9.50 of $9.50",
  },
] as const) {
  test(`keeps event viewing available at the ${scenario.cents}-cent AI tier`, async ({ page }) => {
    await mockFoundation(page, {
      status: {
        status: {
          ...HEALTHY_STATUS.status,
          aiSpendTier: scenario.tier,
          aiMonthlyCents: scenario.cents,
          warningCodes: [scenario.warning],
        },
      },
    });

    await page.goto("/");

    await expect(page.getByText("Advanced data systems", { exact: true })).toBeVisible();
    const cost = page.getByLabel("AI cost status");
    await expect(cost).toContainText(scenario.title);
    await expect(cost).toContainText(scenario.copy);
    await expect(cost).toContainText(scenario.amount);
  });
}

test("reflects safe database and backup warnings without leaking internals", async ({ page }) => {
  await mockFoundation(page, {
    status: {
      status: {
        ...HEALTHY_STATUS.status,
        databaseUsageWarning: true,
        r2UsageWarning: true,
        safeErrorCode: "quota",
      },
    },
  });

  await page.goto("/");

  const signal = page.getByRole("region", { name: "Foundation signal" });
  await expect(signal.getByText("Database usage needs review.")).toBeVisible();
  await expect(signal.getByText("Backup storage usage needs review.")).toBeVisible();
  await expect(page.getByText(/database_url|ciphertext|token|stack trace/i)).toHaveCount(0);
});

test("shows empty, loading, and retryable failure states", async ({ page }) => {
  await mockConnectedShell(page);
  let statusAttempts = 0;
  let releaseEvents: (() => void) | undefined;
  const eventsReleased = new Promise<void>((resolve) => {
    releaseEvents = resolve;
  });
  await page.route("**/api/diagnostics/status", (route) => {
    statusAttempts += 1;
    return statusAttempts === 1
      ? fulfillJson(route, { error: { code: "DIAGNOSTICS_UNAVAILABLE" } }, 503)
      : fulfillJson(route, HEALTHY_STATUS);
  });
  await page.route("**/api/calendar/events", async (route) => {
    await eventsReleased;
    await fulfillJson(route, { events: [] });
  });

  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Opening your calendar");
  releaseEvents?.();
  await expect(page.getByRole("alert")).toContainText("Vision could not load the latest foundation status.");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("No synchronized events yet.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Foundation signal" })).toContainText("Healthy");
});

test("handles expired sessions and forbidden corrections safely", async ({ page }) => {
  await page.route("**/api/auth/session", (route) =>
    fulfillJson(route, { error: { code: "AUTHENTICATION_REQUIRED" } }, 401));
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Sign in with Google" })).toBeVisible();

  await page.unrouteAll({ behavior: "wait" });
  await mockFoundation(page, { events: [EVENTS[1]] });
  await page.route("**/api/calendar/events/event-unresolved/category", (route) =>
    fulfillJson(route, { error: { code: "CSRF_INVALID" } }, 403));
  await page.reload();
  const item = page.getByRole("listitem").filter({ hasText: "Planning session" });
  await item.getByRole("combobox", { name: "Category for Planning session" }).selectOption("personal");
  await expect(page.getByRole("alert")).toContainText("Category was not saved. Refresh Vision and try again.");
  await expect(item.getByText("Needs category")).toBeVisible();
});

test("keeps keyboard focus through a delayed successful correction", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await mockFoundation(page, { events: [EVENTS[1]] });
  let correctionCalls = 0;
  let releaseCorrection!: () => void;
  const correctionReleased = new Promise<void>((resolve) => {
    releaseCorrection = resolve;
  });
  await page.route("**/api/calendar/events/event-unresolved/category", async (route) => {
    correctionCalls += 1;
    await correctionReleased;
    await fulfillJson(route, {
      category: {
        id: "event-unresolved",
        domain: "personal",
        domainState: "confirmed",
        categoryProvenance: "user",
        assignedAt: "2026-07-25T15:00:00.000Z",
        version: 4,
      },
    });
  });

  await page.goto("/");
  const select = page.getByRole("combobox", { name: "Category for Planning session" });
  await select.focus();
  await select.selectOption("personal");
  await expect(page.getByRole("status")).toContainText("Saving category");
  await expect(select).toBeFocused();
  await expect(select).toHaveAttribute("aria-busy", "true");
  await select.evaluate((element) => {
    if (!(element instanceof HTMLSelectElement)) throw new Error("Expected a category select.");
    element.value = "work";
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(correctionCalls).toBe(1);
  await expect(select).toBeFocused();
  releaseCorrection();
  await expect(page.getByRole("status")).toContainText("Category saved");
  await expect(select).toBeFocused();
  await expect(select).toHaveAttribute("aria-busy", "false");
  await expect(select).toHaveCSS("min-height", "44px");
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test("keeps keyboard focus through a delayed failed correction", async ({ page }) => {
  await mockFoundation(page, { events: [EVENTS[1]] });
  let releaseCorrection!: () => void;
  const correctionReleased = new Promise<void>((resolve) => {
    releaseCorrection = resolve;
  });
  await page.route("**/api/calendar/events/event-unresolved/category", async (route) => {
    await correctionReleased;
    await fulfillJson(route, { error: { code: "CSRF_INVALID" } }, 403);
  });

  await page.goto("/");
  const select = page.getByRole("combobox", { name: "Category for Planning session" });
  await select.focus();
  await select.selectOption("school");
  await expect(page.getByRole("status")).toContainText("Saving category");
  await expect(select).toBeFocused();
  releaseCorrection();
  await expect(page.getByRole("alert")).toContainText("Category was not saved");
  await expect(select).toBeFocused();
  await expect(select).toHaveAttribute("aria-busy", "false");
});
