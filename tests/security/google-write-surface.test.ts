import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { scanRelease } from "../../scripts/scan-release";
import {
  createCleanReleaseFixture,
  PROTECTED_SENTINEL,
  writeFixtureFile,
} from "./release-test-fixture";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Phase B Google and route write surface", () => {
  it("accepts only the approved read/setup calls and Vision-only category route", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual([]);
  });

  it.each(["insert", "update", "patch", "move", "delete"])(
    "rejects Google calendar.events.%s",
    async (method) => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/integrations/google-calendar/write-client.ts",
        `calendar.events.${method}({ calendarId: "primary", requestBody: {} });`,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(
      result.violations.filter(
        ({ category }) => category === "google-event-write",
      ),
    ).toEqual(
      [expect.objectContaining({ category: "google-event-write" })],
    );
    },
  );

  it.each([
    ["post", "/api/calendar/events"],
    ["put", "/api/calendar/events/:id"],
    ["patch", "/api/calendar/events/:id"],
    ["post", "/api/calendar/events/:id/move"],
    ["post", "/api/calendar/events/:id/cancel"],
    ["delete", "/api/calendar/events/:id"],
  ])("rejects a Worker %s %s event-write route", async (method, route) => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/server/api/write-routes.ts",
      `app.${method}("${route}", writeEvent);`,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "event-write-route" }),
      ]),
    );
  });

  it("rejects a direct non-watch Google event HTTP mutation", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/integrations/google-calendar/event-sync-client.ts",
      `
        export function write(fetcher: typeof fetch) {
          return fetcher("https://www.googleapis.com/calendar/v3/calendars/id/events", {
            method: "PATCH",
          });
        }
      `,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "google-event-write" }),
      ]),
    );
  });

  it("rejects a Google endpoint outside the explicit adapter allowlist", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/integrations/google-calendar/calendar-client.ts",
      `
        const GOOGLE_CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";
        export function query(fetcher: typeof fetch) {
          return fetcher(\`\${GOOGLE_CALENDAR_BASE_URL}/freeBusy\`, { method: "POST" });
        }
      `,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "google-event-write" }),
      ]),
    );
  });
});
