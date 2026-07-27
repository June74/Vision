import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROTECTED_RELEASE_SENTINEL } from "../../scripts/scan-release";

export const PROTECTED_SENTINEL = PROTECTED_RELEASE_SENTINEL;

const evidenceFiles = [
  ["application-logs/captured.ndjson", "src/server/logging.ts#logEvent"],
  ["audit/audit.ndjson", "src/audit/audit-writer.ts#AuditWriter.write"],
  ["queue/queue.ndjson", "src/jobs/queue-message.ts#parseCalendarSyncMessage"],
  [
    "database-raw/rows.ndjson",
    "src/data/repositories/event-repository.ts#prepareStoredEventRow",
  ],
  [
    "r2-unencrypted/object.json",
    "src/crypto/backup-envelope.ts#encryptBackupEnvelope",
  ],
] as const;

export async function createCleanReleaseFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vision-release-scan-"));
  const clientRelativePath = "assets/app.js";
  const clientContents = "globalThis.__VISION_RELEASE_BUILD__ = true;";
  await writeFixtureFile(
    root,
    `dist/client/${clientRelativePath}`,
    clientContents,
  );
  await writeFixtureFile(
    root,
    "dist/vision/index.js",
    "globalThis.__VISION_WORKER_RELEASE_BUILD__ = true;",
  );
  const buildDigest = createHash("sha256")
    .update(`${Buffer.byteLength(clientRelativePath, "utf8")}:`)
    .update(clientRelativePath, "utf8")
    .update(`${Buffer.byteLength(clientContents, "utf8")}:`)
    .update(clientContents, "utf8")
    .digest("hex");
  const capturedAt = new Date().toISOString();
  const runId = "00000000-0000-4000-8000-000000000001";
  await writeFixtureFile(
    root,
    "dist/release-evidence/manifest.json",
    JSON.stringify({
      evidenceVersion: 1,
      generator: "scripts/capture-release-evidence.ts",
      runId,
      capturedAt,
      buildDigest,
    }),
  );
  for (const [relativePath, source] of evidenceFiles) {
    const surface = relativePath.split("/")[0]?.replace("-", "_");
    await writeFixtureFile(
      root,
      `dist/release-evidence/${relativePath}`,
      `${JSON.stringify({
        evidenceVersion: 1,
        surface,
        capturedAt,
        buildDigest,
        provenance: {
          generator: "scripts/capture-release-evidence.ts",
          runId,
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
