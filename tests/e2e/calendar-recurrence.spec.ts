import { expect, test, type Page, type Route } from "@playwright/test";

const SESSION = {
  authenticated: true,
  csrfToken: "test-csrf-token",
  email: "owner@example.com",
  expiresAt: "2026-08-20T22:00:00.000Z",
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
}

test("preserves recurrence and notification intent while redacting attendee addresses in the browser response", async ({ page }) => {
  await mockConnectedShell(page);
  await page.route("**/api/calendar/mutations/preview", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-vision-csrf"]).toBe(SESSION.csrfToken);
    expect(JSON.parse(route.request().postData() ?? "{}")).toEqual({
      action: "update",
      eventId: "event-series",
      scope: "series",
      after: {
        attendees: ["alice@example.com", "bob@example.com", "carol@example.com"],
        recurrence: {
          scope: "series",
          rules: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
        },
        notifications: "provider-default",
      },
    });
    await fulfillJson(route, {
      operationId: "op-browser-series-1",
      action: "update",
      expiresAt: "2026-08-20T19:10:00.000Z",
      preview: {
        before: {
          title: "Weekly review",
          description: null,
          startsAt: "2026-08-24T15:00:00.000Z",
          endsAt: "2026-08-24T16:00:00.000Z",
          timeZone: "America/Chicago",
          domain: "work",
          privacy: "private",
          status: "confirmed",
          attendees: { mode: "count", count: 3, addresses: [] },
          recurrence: { scope: "series", rules: ["RRULE:FREQ=WEEKLY;BYDAY=MO"] },
          notifications: { policy: "provider-default", willNotify: true },
        },
        after: {
          title: "Weekly review",
          description: null,
          startsAt: "2026-08-24T15:00:00.000Z",
          endsAt: "2026-08-24T16:00:00.000Z",
          timeZone: "America/Chicago",
          domain: "work",
          privacy: "private",
          status: "confirmed",
          attendees: { mode: "count", count: 3, addresses: [] },
          recurrence: { scope: "series", rules: ["RRULE:FREQ=WEEKLY;BYDAY=MO"] },
          notifications: { policy: "provider-default", willNotify: true },
        },
      },
      undoAvailable: false,
    });
  });

  await page.goto("/");
  const response = await page.evaluate(async (csrfToken) => {
    const result = await fetch("/api/calendar/mutations/preview", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-vision-csrf": csrfToken,
      },
      body: JSON.stringify({
        action: "update",
        eventId: "event-series",
        scope: "series",
        after: {
          attendees: ["alice@example.com", "bob@example.com", "carol@example.com"],
          recurrence: {
            scope: "series",
            rules: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
          },
          notifications: "provider-default",
        },
      }),
    });
    return { status: result.status, text: await result.text() };
  }, SESSION.csrfToken);

  expect(response.status).toBe(200);
  expect(response.text).not.toContain("alice@example.com");
  expect(response.text).not.toContain("bob@example.com");
  expect(response.text).not.toContain("carol@example.com");
  expect(response.text).toContain('"mode":"count"');
  expect(response.text).toContain('"count":3');
  expect(response.text).toContain('"scope":"series"');
  expect(response.text).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
  expect(response.text).toContain('"policy":"provider-default"');
});
