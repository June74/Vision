import { describe, expect, it, vi } from "vitest";
import {
  EventSyncClientError,
  createGoogleEventSyncClient,
} from "../../../src/integrations/google-calendar/event-sync-client";

const calendarId = "calendar/provider id";
const accessToken = "test-access-token";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function timedEvent(id = "event-1") {
  return {
    id,
    status: "confirmed",
    updated: "2026-07-24T13:00:00.000Z",
    start: { dateTime: "2026-07-24T09:00:00-05:00" },
    end: { dateTime: "2026-07-24T10:00:00-05:00" },
    summary: "protected title",
  };
}

describe("Google events.list incremental synchronization contract", () => {
  it("keeps the same collection query across pages and maps with the response timezone", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          timeZone: "America/Chicago",
          items: [
            {
              id: "all-day",
              status: "confirmed",
              updated: "2026-07-24T13:00:00Z",
              start: { date: "2026-07-24" },
              end: { date: "2026-07-25" },
            },
          ],
          nextPageToken: "page-2",
        }),
      )
      .mockResolvedValueOnce(
        response({
          timeZone: "America/Chicago",
          items: [timedEvent()],
          nextSyncToken: "next-sync",
        }),
      );
    const client = createGoogleEventSyncClient({ accessToken, fetcher });

    const first = await client.listChanges({ calendarId, syncToken: "old-sync" });
    const second = await client.listChanges({
      calendarId,
      syncToken: "old-sync",
      pageToken: first.nextPageToken,
    });

    expect(first.changes[0]).toMatchObject({
      startsAt: "2026-07-24T05:00:00.000Z",
      timeZone: "America/Chicago",
      type: "upsert",
    });
    expect(second.nextSyncToken).toBe("next-sync");
    const urls = fetcher.mock.calls.map(([input]) => new URL(String(input)));
    expect(urls[0]!.pathname).toBe(
      "/calendar/v3/calendars/calendar%2Fprovider%20id/events",
    );
    for (const url of urls) {
      expect(url.searchParams.get("showDeleted")).toBe("true");
      expect(url.searchParams.get("singleEvents")).toBe("false");
      expect(url.searchParams.get("maxResults")).toBe("2500");
      expect(url.searchParams.get("syncToken")).toBe("old-sync");
    }
    expect(urls[0]!.searchParams.has("pageToken")).toBe(false);
    expect(urls[1]!.searchParams.get("pageToken")).toBe("page-2");
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
      headers: { authorization: `Bearer ${accessToken}` },
      method: "GET",
    });
  });

  it("classifies authorization, transient, expired-token, and permanent provider failures safely", async () => {
    for (const [status, category] of [
      [401, "authorization"],
      [410, "sync_token_invalid"],
      [429, "transient"],
      [500, "transient"],
      [503, "transient"],
      [400, "provider"],
    ] as const) {
      const client = createGoogleEventSyncClient({
        accessToken,
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(
          response({ error: { message: "must not escape" } }, status),
        ),
      });
      const failure = await client
        .listChanges({ calendarId, syncToken: "old-sync" })
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(EventSyncClientError);
      expect(failure).toMatchObject({ category, status });
      expect(String(failure)).not.toContain("must not escape");
      expect(String(failure)).not.toContain(accessToken);
      expect(String(failure)).not.toContain("old-sync");
    }
  });

  it("classifies bounded Google 403 reasons without treating rate limits as revoked access", async () => {
    for (const [reason, category] of [
      ["rateLimitExceeded", "transient"],
      ["userRateLimitExceeded", "transient"],
      ["insufficientPermissions", "authorization"],
      ["forbidden", "authorization"],
      ["quotaExceeded", "quota"],
      ["unknownReason", "provider"],
    ] as const) {
      const client = createGoogleEventSyncClient({
        accessToken,
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(
          response({
            error: {
              errors: [{ domain: "usageLimits", reason, message: "must not escape" }],
              code: 403,
              message: "must not escape",
            },
          }, 403),
        ),
      });
      const failure = await client
        .listChanges({ calendarId, syncToken: "old-sync" })
        .catch((error: unknown) => error);
      expect(failure).toMatchObject({ category, status: 403 });
      expect(String(failure)).not.toContain("must not escape");
      expect(String(failure)).not.toContain(reason);
    }
  });

  it("treats oversized or malformed 403 bodies as a safe permanent provider failure", async () => {
    for (const body of [
      "x".repeat(9 * 1024),
      JSON.stringify({ error: { errors: "invalid" } }),
    ]) {
      const client = createGoogleEventSyncClient({
        accessToken,
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(
          new Response(body, { status: 403 }),
        ),
      });
      await expect(client.listChanges({ calendarId })).rejects.toMatchObject({
        category: "provider",
        status: 403,
      });
    }
  });

  it("rejects an oversized successful provider page before mapping it", async () => {
    const client = createGoogleEventSyncClient({
      accessToken,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        new Response("x".repeat(8 * 1024 * 1024 + 1), { status: 200 }),
      ),
    });

    await expect(client.listChanges({ calendarId })).rejects.toMatchObject({
      category: "payload_too_large",
      status: 200,
    });
  });

  it("rejects malformed pages and a nonterminal sync token as schema failures", async () => {
    for (const body of [
      { timeZone: "America/Chicago", items: [], nextPageToken: "p", nextSyncToken: "s" },
      { timeZone: "America/Chicago", items: [] },
      { timeZone: "America/Chicago", items: "not-an-array", nextSyncToken: "s" },
      { timeZone: "", items: [], nextSyncToken: "s" },
    ]) {
      const client = createGoogleEventSyncClient({
        accessToken,
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(response(body)),
      });
      await expect(
        client.listChanges({ calendarId }),
      ).rejects.toMatchObject({ category: "schema" });
    }
  });

  it("maps sparse deleted resources as unversioned tombstones", async () => {
    const client = createGoogleEventSyncClient({
      accessToken,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        response({
          timeZone: "America/Chicago",
          items: [{ id: "gone", status: "cancelled" }],
          nextSyncToken: "next-sync",
        }),
      ),
    });

    await expect(client.listChanges({ calendarId })).resolves.toMatchObject({
      changes: [
        {
          type: "delete",
          target: {
            sourceCalendarId: calendarId,
            sourceEventId: "gone",
            sourceSystem: "google-calendar",
          },
        },
      ],
    });
  });
});
