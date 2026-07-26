import { expect, test, type Page, type Route } from "@playwright/test";

const SESSION = {
  authenticated: true,
  csrfToken: "test-csrf-token",
  email: "owner@example.com",
  expiresAt: "2026-07-26T00:00:00.000Z",
};

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
    copy: "Vision is catching up. Your calendar remains available.",
  },
  {
    state: "Action required",
    copy: "Vision needs your attention before synchronization can recover.",
  },
  {
    state: "Disconnected",
    copy: "Reconnect Google Calendar to resume synchronization.",
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

    await page.goto("/");

    await expect(page.getByText(scenario.state, { exact: true })).toBeVisible();
    await expect(page.getByText(scenario.copy)).toBeVisible();
    await expect(page.getByText(/Last synchronized/)).toBeVisible();
  });
}

test("keeps event viewing available when AI is near its limit or stopped", async ({ page }) => {
  await mockFoundation(page, {
    status: {
      status: {
        ...HEALTHY_STATUS.status,
        aiSpendTier: "stopped",
        aiMonthlyCents: 950,
        warningCodes: ["AI_BUDGET_STOPPED"],
      },
    },
  });

  await page.goto("/");

  await expect(page.getByText("Advanced data systems", { exact: true })).toBeVisible();
  await expect(page.getByLabel("AI cost status")).toContainText("AI paused");
  await expect(page.getByLabel("AI cost status")).toContainText("Calendar viewing and category changes still work.");
  await expect(page.getByLabel("AI cost status")).toContainText("$9.50 of $9.50");
});

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

test("supports keyboard correction with 44px controls and no narrow-screen horizontal trap", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await mockFoundation(page, { events: [EVENTS[1]] });
  await page.route("**/api/calendar/events/event-unresolved/category", (route) =>
    fulfillJson(route, {
      category: {
        id: "event-unresolved",
        domain: "personal",
        domainState: "confirmed",
        categoryProvenance: "user",
        assignedAt: "2026-07-25T15:00:00.000Z",
        version: 4,
      },
    }));

  await page.goto("/");
  const select = page.getByRole("combobox", { name: "Category for Planning session" });
  await select.focus();
  await select.selectOption("personal");
  await expect(page.getByRole("status")).toContainText("Category saved");
  await expect(select).toHaveCSS("min-height", "44px");
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
