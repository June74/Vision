import { expect, test, type Page, type Route } from "@playwright/test";

const SESSION = {
  authenticated: true,
  csrfToken: "test-csrf-token",
  email: "owner@example.com",
  expiresAt: "2026-08-20T22:00:00.000Z",
};

async function fulfillJson(route: Route, body: Record<string, unknown>, status = 200): Promise<void> {
  await route.fulfill({ body: JSON.stringify(body), contentType: "application/json", status });
}

async function mockConnectedShell(page: Page): Promise<void> {
  await page.route("**/api/auth/session", (route) => fulfillJson(route, SESSION));
  await page.route("**/api/setup/calendar", (route) => fulfillJson(route, {
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
  }));
  await page.route("**/api/diagnostics/status", (route) => fulfillJson(route, {
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
  }));
  await page.route("**/api/calendar/events", (route) => fulfillJson(route, { events: [] }));
  await page.route("**/api/secretary/today**", (route) => fulfillJson(route, {
    today: {
      dateKey: "2026-08-20",
      calendarWriteAuthority: "approval-required",
      tasks: [],
      events: [],
      captures: [],
      notes: [],
    },
  }));
}

test("shows the local secretary capture flow without offering implicit calendar confirmation", async ({ page }) => {
  await mockConnectedShell(page);
  await page.route("**/api/secretary/captures", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-vision-csrf"]).toBe(SESSION.csrfToken);
    expect(JSON.parse(route.request().postData() ?? "{}")).toEqual({
      content: "calendar: dentist Friday at 2",
    });
    await fulfillJson(route, {
      capture: {
        id: "capture-1",
        content: "calendar: dentist Friday at 2",
        title: "dentist Friday at 2",
        kind: "calendar_candidate",
        ambiguity: "none",
        createdAt: "2026-08-20T14:00:00.000Z",
        calendarProposal: {
          action: "create",
          status: "pending_approval",
          requiresExplicitApproval: true,
          canConfirm: false,
        },
      },
    }, 201);
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Local secretary" })).toBeVisible();
  await page.getByLabel("Capture something").fill("calendar: dentist Friday at 2");
  await page.getByRole("button", { name: "Save capture" }).click();
  await expect(page.getByLabel("Recent captures").getByText("Calendar candidate — approval required", { exact: true })).toBeVisible();
  await expect(page.getByText("No calendar change was confirmed.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /confirm calendar/i })).toHaveCount(0);
});
