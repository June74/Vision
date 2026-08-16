import { readFile, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
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
  it("keeps acceptance control and Google event writes off every public route", async () => {
    const apiRoot = resolve(process.cwd(), "src", "server", "api");
    const apiFiles = (await readdir(apiRoot, {
      recursive: true,
      withFileTypes: true,
    }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => resolve(entry.parentPath, entry.name));
    const sources = await Promise.all([
      ...apiFiles.map((file) => readFile(file, "utf8")),
      readFile(resolve(process.cwd(), "src", "worker.ts"), "utf8"),
    ]);
    const publicSurface = sources.join("\n");

    expect(publicSurface).not.toMatch(
      /["'`]\/api\/(?:operator|acceptance)(?:\/|["'`])/u,
    );
  });

  it("accepts only the approved read/setup calls and Vision-only category route", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual([]);
  });

  it("accepts only the exact authenticated Phase C one-off write route surface", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/server/api/calendar-write-routes.ts",
      `
        export function registerCalendarWriteRoutes(app: Hono) {
          app.post("/api/calendar/writes/preview", preview);
          app.get("/api/calendar/writes/:operationId", status);
          app.post("/api/calendar/writes/:operationId/confirm", confirm);
          app.post("/api/calendar/writes/:operationId/undo", undo);
        }
      `,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual([]);
  });

  it("accepts the bounded Phase C Google event-write transport forwarder", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/integrations/google-calendar/event-write-client.ts",
      `
        const GOOGLE_CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";
        async function requestJson(
          url: string,
          init: RequestInit,
          fetcher: typeof fetch,
        ) {
          return fetcher(url, { ...init });
        }
        export async function create(fetcher: typeof fetch) {
          return requestJson(
            GOOGLE_CALENDAR_BASE_URL + "/calendars/id/events",
            { method: "POST" },
            fetcher,
          );
        }
      `,
    );

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

  it("rejects the wrong method on an approved Google endpoint", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/integrations/google-calendar/calendar-client.ts",
      `
        const GOOGLE_CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";
        export function removeCalendar(fetcher: typeof fetch) {
          return fetcher(\`\${GOOGLE_CALENDAR_BASE_URL}/users/me/calendarList/id\`, {
            method: "DELETE",
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

  it("fails closed when an approved adapter call cannot be resolved", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/integrations/google-calendar/event-sync-client.ts",
      `
        export function request(fetcher: typeof fetch, url: string) {
          return fetcher(url, { method: "GET" });
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

  it.each([
    [
      "renamed Hono receiver",
      `calendarRoutes.delete("/api/calendar/events/:id", writeEvent);`,
    ],
    [
      "constant event path",
      `
        const EVENT_ROUTE = "/api/calendar/events/:id";
        calendarRoutes.delete(EVENT_ROUTE, writeEvent);
      `,
    ],
    [
      "unresolved mutating Hono path",
      `
        declare const calendarRoutes: Hono;
        calendarRoutes.delete(UNKNOWN_EVENT_ROUTE, writeEvent);
      `,
    ],
  ])("fails closed for a %s route declaration", async (_label, source) => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(root, "src/server/api/write-routes.ts", source);

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "event-write-route" }),
      ]),
    );
  });

  it("blocks an event-write route declared directly in the Worker entrypoint", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/worker.ts",
      `
        const app = new Hono();
        app.post("/api/calendar/events", writeEvent);
      `,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "event-write-route",
          file: "src/worker.ts",
        }),
      ]),
    );
  });

  it.each([
    `
      declare const app: Hono;
      app.on("DELETE", "/api/calendar/events/:id", writeEvent);
    `,
    `
      declare const app: Hono;
      app.route("/api/calendar/events", eventRouter);
    `,
  ])("blocks alternate Hono event route registration", async (source) => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(root, "src/server/api/write-routes.ts", source);

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "event-write-route" }),
      ]),
    );
  });

  it.each([
    `
      declare const app: Hono;
      app.all("/api/calendar/events", writeEvent);
    `,
    `
      const eventRoutes = new Hono().basePath("/api/calendar/events");
      eventRoutes.post("/", writeEvent);
    `,
  ])("blocks an all-method or base-path event registration", async (source) => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(root, "src/server/api/write-routes.ts", source);

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "event-write-route" }),
      ]),
    );
  });

  it("rejects an aliased Google event mutation method", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/integrations/google-calendar/write-client.ts",
      `
        const insertEvent = calendar.events.insert;
        insertEvent({ calendarId: "primary", requestBody: {} });
      `,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "google-event-write" }),
      ]),
    );
  });

  it("rejects a Google event mutation outside the adapter directories", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/server/google-write.ts",
      `
        export function removeEvent(fetcher: typeof fetch) {
          return fetcher(
            "https://www.googleapis.com/calendar/v3/calendars/id/events/event",
            { method: "DELETE" },
          );
        }
      `,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "google-event-write",
          file: "src/server/google-write.ts",
        }),
      ]),
    );
  });

  it("rejects a renamed Google HTTP transport", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/integrations/google-calendar/event-sync-client.ts",
      `
        export function removeEvent(transport: typeof fetch) {
          return transport(
            "https://www.googleapis.com/calendar/v3/calendars/id/events/event",
            { method: "DELETE" },
          );
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

  it("allows the approved Google event-get operation", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/integrations/google-calendar/event-sync-client.ts",
      `
        export function getEvent(transport: typeof fetch) {
          return transport(
            "https://www.googleapis.com/calendar/v3/calendars/id/events/event",
            { method: "GET" },
          );
        }
      `,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(
      result.violations.filter(
        ({ category }) => category === "google-event-write",
      ),
    ).toEqual([]);
  });

  it("rejects a mutation through an aliased events object", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/integrations/google-calendar/calendar-client.ts",
      `
        const eventOperations = calendar.events;
        eventOperations.delete({ calendarId: "primary", eventId: "event" });
      `,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "google-event-write" }),
      ]),
    );
  });

  it("rejects a computed Google event mutation member", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/integrations/google-calendar/calendar-client.ts",
      `
        calendar.events["delete"]({
          calendarId: "primary",
          eventId: "event",
        });
      `,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "google-event-write" }),
      ]),
    );
  });

  it("rejects a statically resolved variable Google event mutation member", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/integrations/google-calendar/calendar-client.ts",
      `
        const operation = "delete";
        calendar.events[operation]({
          calendarId: "primary",
          eventId: "event",
        });
      `,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "google-event-write" }),
      ]),
    );
  });

  it("fails closed for an unresolved Google event collection member", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/integrations/google-calendar/calendar-client.ts",
      `
        declare const operation: string;
        calendar.events[operation]({
          calendarId: "primary",
          eventId: "event",
        });
      `,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "google-event-write" }),
      ]),
    );
  });

  it("fails closed for an unresolved endpoint through a typed renamed transport", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/server/google-write.ts",
      `
        const GOOGLE_CALENDAR_ENDPOINT = "https://www.googleapis.com/calendar/v3";
        declare function buildGoogleUrl(): string;
        export function remove(transport: typeof fetch) {
          return transport(buildGoogleUrl(), { method: "DELETE" });
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

  it("fails closed for an unresolved endpoint through a typed transport property", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/server/google-write.ts",
      `
        const GOOGLE_CALENDAR_ENDPOINT = "https://www.googleapis.com/calendar/v3";
        declare function buildGoogleUrl(): string;
        export class GoogleWriter {
          constructor(private readonly transport: typeof fetch) {}

          remove() {
            return this.transport(buildGoogleUrl(), { method: "DELETE" });
          }
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

  it("fails closed for an unresolved endpoint through an inferred fetch property", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/server/google-write.ts",
      `
        const GOOGLE_CALENDAR_ENDPOINT = "https://www.googleapis.com/calendar/v3";
        declare function buildGoogleUrl(): string;
        export class GoogleWriter {
          private readonly transport = fetch;

          remove() {
            return this.transport(buildGoogleUrl(), { method: "DELETE" });
          }
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

  it.each([
    `
      const app = new Hono();
      app["post"]("/api/calendar/events", writeEvent);
    `,
    `
      const app = new Hono();
      const verb = "post";
      app[verb]("/api/calendar/events", writeEvent);
    `,
    `
      const app = new Hono();
      declare const verb: string;
      app[verb]("/api/calendar/events", writeEvent);
    `,
  ])("rejects computed Hono route registrations", async (source) => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(root, "src/server/api/write-routes.ts", source);

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "event-write-route" }),
      ]),
    );
  });

  it("rejects a variable forbidden method on an approved endpoint", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/integrations/google-calendar/calendar-client.ts",
      `
        const GOOGLE_CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";
        const method = "DELETE";
        export function remove(fetcher: typeof fetch) {
          return fetcher(\`\${GOOGLE_CALENDAR_BASE_URL}/calendars\`, { method });
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

  it.each([
    "/api/calendar/create",
    "/api/calendar/event/:id",
  ])("rejects an unapproved mutating route at %s", async (route) => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/server/api/write-routes.ts",
      `
        declare const app: Hono;
        app.post("${route}", writeEvent);
      `,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "event-write-route" }),
      ]),
    );
  });

  it.each([
    `
      declare const app: Hono;
      app.mount("/api/calendar/events", writeEvent.fetch);
    `,
    `
      new Hono()
        .basePath("/api/calendar/events")
        .post("/", writeEvent);
    `,
  ])("rejects mounted and chained event-write registrations", async (source) => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(root, "src/server/api/write-routes.ts", source);

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "event-write-route" }),
      ]),
    );
  });

  it("scans source with an unsafe filename without reflecting that name", async () => {
    const root = await createCleanReleaseFixture();
    roots.push(root);
    await writeFixtureFile(
      root,
      "src/server/api/write@routes.ts",
      `
        declare const app: Hono;
        app.delete("/api/calendar/events/:id", writeEvent);
      `,
    );

    const result = await scanRelease({ projectRoot: root, protectedSentinel: PROTECTED_SENTINEL });
    const finding = result.violations.find(
      ({ category }) => category === "event-write-route",
    );

    expect(finding?.file).toMatch(/^unsafe-path-[a-f0-9]{16}$/u);
    expect(finding?.file).not.toContain("write@routes");
  });
});
