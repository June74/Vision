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
    today: { dateKey: "2026-08-20", calendarWriteAuthority: "approval-required", tasks: [], events: [], captures: [], notes: [] },
  }));
  await page.route("**/api/planning/briefing**", (route) => fulfillJson(route, {
    briefing: {
      briefingId: "briefing-1",
      window: { kind: "morning", startsAt: "2026-08-20T12:00:00.000Z", endsAt: "2026-08-20T17:00:00.000Z", timeZone: "America/Chicago" },
      sections: [],
      citations: [],
      automation: { mode: "template", aiEnabled: false },
      calendarWrite: { authority: "approval-required", canConfirm: false },
    },
  }));
  await page.route("**/api/planning/follow-ups", (route) => fulfillJson(route, { followUps: [] }));
}

test("shows deterministic planning and keeps calendar confirmation outside the planning surface", async ({ page }) => {
  await mockConnectedShell(page);
  await page.route("**/api/planning/proposals", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-vision-csrf"]).toBe(SESSION.csrfToken);
    await fulfillJson(route, {
      proposal: {
        proposalId: "proposal-1",
        title: "Focus block",
        durationMinutes: 60,
        status: "ready",
        alternatives: [{
          id: "slot-1",
          startsAt: "2026-08-20T14:00:00.000Z",
          endsAt: "2026-08-20T15:00:00.000Z",
          localStart: "2026-08-20 09:00",
          localEnd: "2026-08-20 10:00",
          timeZone: "America/Chicago",
          citations: [],
        }],
        conflicts: [],
        ambiguity: [],
        citations: [],
        automation: { mode: "deterministic", aiEnabled: false },
        calendarWrite: { authority: "approval-required", canConfirm: false, approvalOperationId: null },
      },
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Planning desk" })).toBeVisible();
  await page.getByLabel("Planning title").fill("Focus block");
  await page.getByRole("button", { name: "Find time" }).click();
  await expect(page.getByLabel("Scheduling proposal").getByText("Calendar approval required", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /confirm calendar/i })).toHaveCount(0);
});

test("creates and completes a local follow-up while keeping the briefing deterministic", async ({ page }) => {
  await mockConnectedShell(page);
  await page.route("**/api/planning/follow-ups**", async (route) => {
    const url = route.request().url();
    if (route.request().method() === "GET") {
      await fulfillJson(route, { followUps: [] });
      return;
    }
    expect(route.request().headers()["x-vision-csrf"]).toBe(SESSION.csrfToken);
    if (url.endsWith("/complete")) {
      await fulfillJson(route, {
        followUp: {
          id: "follow-up-1",
          title: "Send the recap",
          dueAt: null,
          timeZone: "America/Chicago",
          sourceFactIds: [],
          status: "completed",
          createdAt: "2026-08-20T14:00:00.000Z",
          updatedAt: "2026-08-20T14:05:00.000Z",
          snoozedUntil: null,
          completedAt: "2026-08-20T14:05:00.000Z",
        },
      });
      return;
    }
    expect(route.request().method()).toBe("POST");
    expect(JSON.parse(route.request().postData() ?? "{}")).toMatchObject({
      title: "Send the recap",
      dueAt: null,
      sourceFactIds: [],
    });
    expect(JSON.parse(route.request().postData() ?? "{}").timeZone).toEqual(expect.any(String));
    await fulfillJson(route, {
      followUp: {
        id: "follow-up-1",
        title: "Send the recap",
        dueAt: null,
        timeZone: "America/Chicago",
        sourceFactIds: [],
        status: "open",
        createdAt: "2026-08-20T14:00:00.000Z",
        updatedAt: "2026-08-20T14:00:00.000Z",
        snoozedUntil: null,
        completedAt: null,
      },
    }, 201);
  });

  await page.goto("/");
  await expect(page.getByText("AI is disabled for this planning surface.", { exact: true })).toBeVisible();
  await page.getByLabel("Follow-up title").fill("Send the recap");
  await page.getByRole("button", { name: "Save follow-up" }).click();
  await expect(page.getByText("Follow-up saved locally", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Local follow-ups").getByText("Send the recap", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Complete" }).click();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
});
