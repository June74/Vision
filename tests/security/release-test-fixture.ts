import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const PROTECTED_SENTINEL =
  "VISION_PROTECTED_SENTINEL_31C2:calendar value";

const evidenceFiles = [
  "application-logs/captured.ndjson",
  "audit/audit.ndjson",
  "queue/queue.ndjson",
  "database-raw/rows.ndjson",
  "r2-unencrypted/object.json",
] as const;

export async function createCleanReleaseFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vision-release-scan-"));
  await writeFixtureFile(
    root,
    "dist/client/assets/app.js",
    "globalThis.__VISION_RELEASE_BUILD__ = true;",
  );
  for (const relativePath of evidenceFiles) {
    await writeFixtureFile(
      root,
      `tests/fixtures/release-evidence/${relativePath}`,
      '{"classification":"synthetic_release_evidence","status":"clean"}\n',
    );
  }
  await writeFixtureFile(
    root,
    "src/integrations/google-calendar/calendar-client.ts",
    `
      const GOOGLE_CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";
      export async function listCalendars(fetcher: typeof fetch) {
        return fetcher(\`\${GOOGLE_CALENDAR_BASE_URL}/users/me/calendarList\`, {
          method: "GET",
        });
      }
      export async function watchEvents(fetcher: typeof fetch) {
        return fetcher(\`\${GOOGLE_CALENDAR_BASE_URL}/calendars/id/events/watch\`, {
          method: "POST",
        });
      }
      export async function stopChannel(fetcher: typeof fetch) {
        return fetcher(\`\${GOOGLE_CALENDAR_BASE_URL}/channels/stop\`, {
          method: "POST",
        });
      }
    `,
  );
  await writeFixtureFile(
    root,
    "src/integrations/google-calendar/event-sync-client.ts",
    `
      export async function listEvents(fetcher: typeof fetch) {
        return fetcher("https://www.googleapis.com/calendar/v3/calendars/id/events", {
          method: "GET",
        });
      }
    `,
  );
  await writeFixtureFile(
    root,
    "src/integrations/google/oauth-client.ts",
    `
      const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
      export async function exchange(fetcher: typeof fetch) {
        return fetcher(GOOGLE_TOKEN_ENDPOINT, { method: "POST" });
      }
    `,
  );
  await writeFixtureFile(
    root,
    "src/server/api/routes.ts",
    `
      app.get("/api/calendar/events", handler);
      app.patch("/api/calendar/events/:id/category", categoryHandler);
    `,
  );
  return root;
}

export async function writeFixtureFile(
  root: string,
  relativePath: string,
  contents: string,
): Promise<void> {
  const path = join(root, ...relativePath.split("/"));
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, contents, "utf8");
}
