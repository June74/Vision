import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROTECTED_RELEASE_SENTINEL } from "../../scripts/scan-release";

export const PROTECTED_SENTINEL = PROTECTED_RELEASE_SENTINEL;

const evidenceFiles = [
  ["application-logs/captured.ndjson", "safe-logger-contract-capture"],
  ["audit/audit.ndjson", "audit-writer-contract-fixture"],
  ["queue/queue.ndjson", "queue-message-contract-fixture"],
  ["database-raw/rows.ndjson", "encrypted-row-export-fixture"],
  ["r2-unencrypted/object.json", "encrypted-r2-envelope-fixture"],
] as const;

export async function createCleanReleaseFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vision-release-scan-"));
  await writeFixtureFile(
    root,
    "dist/client/assets/app.js",
    "globalThis.__VISION_RELEASE_BUILD__ = true;",
  );
  for (const [relativePath, source] of evidenceFiles) {
    const surface = relativePath.split("/")[0]?.replace("-", "_");
    await writeFixtureFile(
      root,
      `tests/fixtures/release-evidence/${relativePath}`,
      `${JSON.stringify({
        evidenceVersion: 1,
        surface,
        capturedAt: "2026-07-25T00:00:00.000Z",
        provenance: {
          generator: "tests/security/release-evidence",
          runId: "phase-b-local-contract",
          source,
        },
        record: { status: "clean" },
      })}\n`,
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
    "src/server/api/diagnostic-routes.ts",
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
