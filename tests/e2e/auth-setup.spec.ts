import { expect, test, type Page } from "@playwright/test";

/** A successful private-pilot browser session without provider credentials. */
const authenticatedSession = {
  authenticated: true,
  csrfToken: "test-csrf-token",
  email: "owner@example.com",
  expiresAt: "2026-07-24T00:00:00.000Z",
};

/** A server setup snapshot shaped exactly like the public calendar API response. */
function setupSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    actionRequired: false,
    candidates: [],
    setupVersion: 1,
    status: "authenticated",
    ...overrides,
  };
}

/** Responds to a session request with the supplied public JSON payload and status. */
async function mockSession(
  page: Page,
  status: number,
  body: Record<string, unknown>,
): Promise<void> {
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ body: JSON.stringify(body), contentType: "application/json", status }),
  );
}

/** Serves the current calendar setup snapshot without reaching a provider. */
async function mockSetupSnapshot(
  page: Page,
  snapshot: Record<string, unknown>,
): Promise<void> {
  await page.route("**/api/setup/calendar", (route) =>
    route.fulfill({ body: JSON.stringify(snapshot), contentType: "application/json" }),
  );
}

test("shows Google sign-in when no Vision session is present", async ({ page }) => {
  await mockSession(page, 401, {
    error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication is required.", requestId: "test" },
  });

  await page.goto("/");

  await expect(page.getByRole("link", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.getByText("Setup creates a secondary Vision calendar with zero events.")).toBeVisible();
});

test("shows the real OAuth callback denial page without calendar controls", async ({ page }) => {
  await page.route("**/api/auth/google/callback**", (route) =>
    route.fulfill({
      body: "<!doctype html><html><body><h1>Access denied</h1><p>This account cannot use Vision.</p></body></html>",
      contentType: "text/html",
      status: 403,
    }),
  );

  await page.goto("/api/auth/google/callback?code=mock&state=mock");

  await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);
});

test("selects and verifies an owned Vision calendar", async ({ page }) => {
  await mockSession(page, 200, authenticatedSession);
  await mockSetupSnapshot(
    page,
    setupSnapshot({
      candidates: [{ calendarId: "calendar-1", providerEtag: "etag", summary: "Vision", timeZone: "America/Chicago" }],
      status: "awaiting_choice",
    }),
  );
  await page.route("**/api/setup/calendar/select", (route) => {
    expect(JSON.parse(route.request().postData() ?? "{}")).toEqual({ calendarId: "calendar-1", setupVersion: 1 });
    expect(route.request().headers()["x-vision-csrf"]).toBe("test-csrf-token");
    return route.fulfill({
      body: JSON.stringify(setupSnapshot({
        connection: { calendarId: "calendar-1", connectionKind: "existing", providerEtag: "etag", timeZone: "America/Chicago", verifiedAt: "2026-07-23T00:00:00.000Z" },
        setupVersion: 2,
        status: "connected",
      })),
      contentType: "application/json",
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Use Vision" }).click();

  await expect(page.getByRole("heading", { name: "Vision calendar connected" })).toBeVisible();
  await expect(page.getByText("Verified existing calendar")).toBeVisible();
});

test("requires the exact creation phrase before enabling calendar creation", async ({ page }) => {
  await mockSession(page, 200, authenticatedSession);
  await mockSetupSnapshot(page, setupSnapshot({ status: "awaiting_confirmation" }));

  await page.goto("/");
  const createButton = page.getByRole("button", { name: "Create Vision calendar" });
  await expect(createButton).toBeDisabled();
  await page.getByLabel("Type CREATE VISION CALENDAR to confirm").fill("create vision calendar");
  await expect(createButton).toBeDisabled();
  await page.getByLabel("Type CREATE VISION CALENDAR to confirm").fill("CREATE VISION CALENDAR");
  await expect(createButton).toBeEnabled();
});

test("submits one creation request with one idempotency key across a double click and reload", async ({ page }) => {
  await mockSession(page, 200, authenticatedSession);
  await mockSetupSnapshot(page, setupSnapshot({ status: "awaiting_confirmation" }));
  let createRequests = 0;
  const idempotencyKeys: string[] = [];
  await page.route("**/api/setup/calendar/confirm-create", (route) => {
    createRequests += 1;
    idempotencyKeys.push(JSON.parse(route.request().postData() ?? "{}").idempotencyKey);
    return route.fulfill({
      body: JSON.stringify(setupSnapshot({
        connection: { calendarId: "calendar-created", connectionKind: "created", providerEtag: "etag", timeZone: "America/Chicago", verifiedAt: "2026-07-23T00:00:00.000Z" },
        setupVersion: 2,
        status: "connected",
      })),
      contentType: "application/json",
    });
  });

  await page.goto("/");
  await page.getByLabel("Type CREATE VISION CALENDAR to confirm").fill("CREATE VISION CALENDAR");
  await page.getByRole("button", { name: "Create Vision calendar" }).dblclick();
  await expect(page.getByRole("heading", { name: "Vision calendar connected" })).toBeVisible();
  await page.reload();

  expect(createRequests).toBe(1);
  expect(idempotencyKeys).toHaveLength(1);
  expect(idempotencyKeys[0]).toMatch(/^[0-9a-f-]{36}$/i);
});

test("replays an in-progress creation after reload with its original version and key", async ({ page }) => {
  await mockSession(page, 200, authenticatedSession);
  let setupResponse = setupSnapshot({ status: "awaiting_confirmation" });
  await page.route("**/api/setup/calendar", (route) => route.fulfill({ body: JSON.stringify(setupResponse), contentType: "application/json" }));
  const requests: { idempotencyKey: string; setupVersion: number }[] = [];
  await page.route("**/api/setup/calendar/confirm-create", (route) => {
    const request = JSON.parse(route.request().postData() ?? "{}") as { idempotencyKey: string; setupVersion: number };
    requests.push(request);
    if (requests.length === 1) {
      setupResponse = setupSnapshot({ retryable: false, setupVersion: 2, status: "creating" });
      return route.fulfill({ body: JSON.stringify(setupResponse), contentType: "application/json", status: 202 });
    }
    if (requests.length === 2) {
      setupResponse = setupSnapshot({ retryable: true, setupVersion: 3, status: "failed" });
      return route.fulfill({ body: JSON.stringify(setupResponse), contentType: "application/json", status: 202 });
    }
    setupResponse = setupSnapshot({ connection: { calendarId: "created", connectionKind: "created", providerEtag: "etag", timeZone: "America/Chicago", verifiedAt: "2026-07-23T00:00:00.000Z" }, setupVersion: 4, status: "connected" });
    return route.fulfill({ body: JSON.stringify(setupResponse), contentType: "application/json" });
  });

  await page.goto("/");
  await page.getByLabel("Type CREATE VISION CALENDAR to confirm").fill("CREATE VISION CALENDAR");
  await page.getByRole("button", { name: "Create Vision calendar" }).click();
  await expect(page.getByRole("heading", { name: "Calendar request in progress" })).toBeVisible();
  await expect(page.getByLabel("Setup signal")).toContainText("Creating");
  await expect(page.getByLabel("Setup signal")).toContainText("v2");
  await page.reload();
  await page.getByRole("button", { name: "Check request status" }).click();
  await expect(page.getByRole("button", { name: "Try request again" })).toBeVisible();
  await page.getByRole("button", { name: "Try request again" }).click();
  await expect(page.getByRole("heading", { name: "Vision calendar connected" })).toBeVisible();
  await expect(page.getByLabel("Setup signal")).toContainText("Connected");
  await expect(page.getByLabel("Setup signal")).toContainText("v4");
  expect(requests).toHaveLength(3);
  expect(new Set(requests.map((request) => request.idempotencyKey)).size).toBe(1);
  expect(requests.map((request) => request.setupVersion)).toEqual([1, 1, 1]);
});

test("uses truthful pending copy and moves keyboard focus to the next setup state", async ({ page }) => {
  await mockSession(page, 200, authenticatedSession);
  await mockSetupSnapshot(page, setupSnapshot());
  await page.route("**/api/setup/calendar/discover", (route) => route.fulfill({ body: JSON.stringify(setupSnapshot({ candidates: [{ calendarId: "calendar-1", providerEtag: "etag", summary: "Vision", timeZone: "America/Chicago" }], setupVersion: 2, status: "awaiting_choice" })), contentType: "application/json" }));

  await page.goto("/");
  await page.getByRole("button", { name: "Find Vision calendars" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Choose the Vision calendar to verify" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Calendar setup state" })).toBeFocused();
  await expect(page.getByText("Creating your Vision calendar")).toHaveCount(0);
});

test("safely handles malformed session and setup responses on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await mockSession(page, 200, { malformed: true });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Vision is temporarily unavailable" })).toBeVisible();
  await expect(page.getByLabel("Setup signal")).toBeVisible();
  await expect(page.locator(".setup-signal")).toHaveCSS("margin-top", "0px");
});

test("uses safe action-required copy after a provider failure", async ({ page }) => {
  await mockSession(page, 200, authenticatedSession);
  await mockSetupSnapshot(page, setupSnapshot({ status: "awaiting_confirmation" }));
  await page.route("**/api/setup/calendar/confirm-create", (route) =>
    route.fulfill({
      body: JSON.stringify(setupSnapshot({ actionRequired: true, retryable: false, status: "failed" })),
      contentType: "application/json",
      status: 409,
    }),
  );

  await page.goto("/");
  await page.getByLabel("Type CREATE VISION CALENDAR to confirm").fill("CREATE VISION CALENDAR");
  await page.getByRole("button", { name: "Create Vision calendar" }).click();

  await expect(page.getByRole("heading", { name: "Calendar setup needs attention" })).toBeVisible();
  await expect(page.getByText("Review your Vision calendars, then try again.")).toBeVisible();
  await expect(page.getByText(/provider stack trace/i)).toHaveCount(0);
});
