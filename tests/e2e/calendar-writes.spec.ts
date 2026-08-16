import { expect, test, type Page, type Route } from "@playwright/test";

const SESSION = {
  authenticated: true,
  csrfToken: "test-csrf-token",
  email: "owner@example.com",
  expiresAt: "2026-08-20T22:00:00.000Z",
};

const CONNECTED_SETUP = {
  actionRequired: false,
  candidates: [],
  connection: {
    calendarId: "vision-calendar",
    connectionKind: "existing",
    providerEtag: "etag-vision-1",
    timeZone: "America/Chicago",
    verifiedAt: "2026-08-20T14:00:00.000Z",
  },
  setupVersion: 4,
  status: "connected",
};

const HEALTHY_STATUS = {
  status: {
    state: "Healthy",
    authorizationState: "connected",
    lastSuccessfulSyncAt: "2026-08-20T14:00:00.000Z",
    syncDelayMs: 0,
    oldestQueuedJobAt: null,
    oldestJobDelayMs: null,
    queueRetryCount: 0,
    failedJobCount: 0,
    channelExpiresAt: "2026-08-22T14:00:00.000Z",
    aiSpendTier: "normal",
    aiMonthlyCents: 214,
    databaseUsageWarning: false,
    r2UsageWarning: false,
    safeErrorCode: null,
    warningCodes: [],
  },
};

const FOUNDATION_EVENTS = [{
  id: "event-school",
  title: "Advanced data systems",
  startsAt: "2026-08-20T14:00:00.000Z",
  endsAt: "2026-08-20T15:15:00.000Z",
  timeZone: "America/Chicago",
  status: "confirmed",
  domain: "school",
  domainState: "inferred",
  categoryProvenance: "model",
}];

const PREVIEW = {
  operationId: "op-browser-write-1",
  expiresAt: "2026-08-20T19:10:00.000Z",
  preview: {
    before: null,
    after: {
      title: "Study session",
      description: null,
      startsAt: "2026-08-20T19:00:00-05:00",
      endsAt: "2026-08-20T20:00:00-05:00",
      timeZone: "America/Chicago",
      domain: "school",
      privacy: "private",
      attendees: { mode: "none", count: 0, addresses: [] },
      recurrence: { scope: "one-off", rules: [] },
      notifications: { policy: "none", willNotify: false },
    },
  },
  undoAvailable: false,
};

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
  await page.route("**/api/auth/session", (route) => fulfillJson(route, SESSION));
  await page.route("**/api/setup/calendar", (route) => fulfillJson(route, CONNECTED_SETUP));
  await page.route("**/api/diagnostics/status", (route) => fulfillJson(route, HEALTHY_STATUS));
  await page.route("**/api/calendar/events", (route) => fulfillJson(route, { events: FOUNDATION_EVENTS }));
}

test("shows the one-off event composer only on an authenticated connected desk", async ({ page }) => {
  await mockConnectedShell(page);
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Add one-off event" })).toBeVisible();
  await page.getByRole("button", { name: "Add one-off event" }).click();
  await expect(page.getByRole("region", { name: "One-off event" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan a one-off event" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm one-off event" })).toBeDisabled();
});

test("previews and confirms a one-off event, reconciles pending state, and undoes only after verification", async ({ page }) => {
  await mockConnectedShell(page);
  let statusReads = 0;

  await page.route("**/api/calendar/writes/preview", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-vision-csrf"]).toBe(SESSION.csrfToken);
    expect(JSON.parse(route.request().postData() ?? "{}")).toEqual({
      title: "Study session",
      description: null,
      startsAt: "2026-08-20T19:00:00-05:00",
      endsAt: "2026-08-20T20:00:00-05:00",
      timeZone: "America/Chicago",
      domain: "school",
      privacy: "private",
      attendees: [],
      recurrence: null,
      notifications: "none",
    });
    await fulfillJson(route, PREVIEW);
  });
  await page.route("**/api/calendar/writes/op-browser-write-1/confirm", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-vision-csrf"]).toBe(SESSION.csrfToken);
    expect(JSON.parse(route.request().postData() ?? "{}")).toEqual({
      confirmation: "CONFIRM ONE-OFF EVENT",
    });
    await fulfillJson(route, {
      operationId: PREVIEW.operationId,
      status: "verification_pending",
      preview: PREVIEW.preview,
      undoAvailable: false,
    }, 202);
  });
  await page.route("**/api/calendar/writes/op-browser-write-1", async (route) => {
    expect(route.request().method()).toBe("GET");
    statusReads += 1;
    await fulfillJson(route, {
      operationId: PREVIEW.operationId,
      status: "verified",
      expiresAt: PREVIEW.expiresAt,
      preview: PREVIEW.preview,
      undoAvailable: true,
    });
  });
  await page.route("**/api/calendar/writes/op-browser-write-1/undo", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-vision-csrf"]).toBe(SESSION.csrfToken);
    expect(JSON.parse(route.request().postData() ?? "{}")).toEqual({
      confirmation: "UNDO ONE-OFF EVENT",
    });
    await fulfillJson(route, {
      operationId: PREVIEW.operationId,
      status: "undone",
      undoAvailable: false,
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Add one-off event" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Study session");
  await page.getByLabel("Start", { exact: true }).fill("2026-08-20T19:00");
  await page.getByLabel("End", { exact: true }).fill("2026-08-20T20:00");
  await page.getByLabel("Time zone", { exact: true }).fill("America/Chicago");
  await page.getByRole("combobox", { name: "Domain", exact: true }).selectOption("school");
  await page.getByRole("button", { name: "Preview event" }).click();

  await expect(page.getByText("Review before changing Google Calendar")).toBeVisible();
  await expect(page.getByText("Study session", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm one-off event" })).toBeEnabled();
  await page.getByRole("button", { name: "Confirm one-off event" }).click();

  await expect(page.getByRole("heading", { name: "Verification pending" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check status" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo this event" })).toHaveCount(0);
  await page.getByRole("button", { name: "Check status" }).click();

  await expect(page.getByRole("heading", { name: "Verified" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo this event" })).toBeVisible();
  await page.getByRole("button", { name: "Undo this event" }).click();
  await expect(page.getByRole("heading", { name: "Undone" })).toBeVisible();
  expect(statusReads).toBe(1);
});

test("recovers one-off event status after reload using only an opaque operation handle", async ({ page }) => {
  await mockConnectedShell(page);
  await page.route("**/api/calendar/writes/preview", (route) => fulfillJson(route, PREVIEW));
  await page.route("**/api/calendar/writes/op-browser-write-1", (route) => fulfillJson(route, {
    operationId: PREVIEW.operationId,
    status: "verified",
    expiresAt: PREVIEW.expiresAt,
    preview: PREVIEW.preview,
    undoAvailable: true,
  }));

  await page.goto("/");
  await page.getByRole("button", { name: "Add one-off event" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Study session");
  await page.getByLabel("Start", { exact: true }).fill("2026-08-20T19:00");
  await page.getByLabel("End", { exact: true }).fill("2026-08-20T20:00");
  await page.getByRole("combobox", { name: "Domain", exact: true }).selectOption("school");
  await page.getByRole("button", { name: "Preview event" }).click();
  await expect(page.getByRole("heading", { name: "Review this one-off event" })).toBeVisible();

  await expect.poll(async () => page.evaluate(() => window.sessionStorage.getItem("vision.calendar-write.active-operation"))).toBe(
    JSON.stringify({ operationId: PREVIEW.operationId, status: "proposed" }),
  );
  await page.reload();

  await expect(page.getByRole("heading", { name: "Verified" })).toBeVisible();
  const stored = await page.evaluate(() => window.sessionStorage.getItem("vision.calendar-write.active-operation"));
  expect(stored).toBe(JSON.stringify({ operationId: PREVIEW.operationId, status: "verified" }));
  expect(stored).not.toContain("Study session");
});

test("does not render one-off event controls when the session is signed out", async ({ page }) => {
  await page.route("**/api/auth/session", (route) =>
    fulfillJson(route, { error: { code: "AUTHENTICATION_REQUIRED" } }, 401));

  await page.goto("/");

  await expect(page.getByRole("link", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: /one-off event/i })).toHaveCount(0);
});

test("keeps the one-off event composer within a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await mockConnectedShell(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Add one-off event" }).click();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(page.getByRole("region", { name: "One-off event" })).toBeVisible();
});
