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

  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.getByText("Setup creates a secondary Vision calendar with zero events.")).toBeVisible();
});

test("shows access denied without calendar controls for a disallowed account", async ({ page }) => {
  await mockSession(page, 403, {
    error: { code: "ACCOUNT_NOT_ALLOWED", message: "This account is not allowed.", requestId: "test" },
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Vision calendar/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Find Vision calendars/i })).toHaveCount(0);
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
