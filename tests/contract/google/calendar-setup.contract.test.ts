import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CalendarClient,
  CalendarProviderError,
} from "../../../src/integrations/google-calendar/calendar-client";

const SUBJECT = "google-subject";
const TOKEN = "ACCESS_TOKEN_SENTINEL";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

describe("Google Calendar setup adapter", () => {
  it("paginates bounded CalendarList reads and keeps only exact owned secondary Vision calendars", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          nextPageToken: "page-two",
          items: [
            {
              id: "primary@example.test",
              summary: "Vision",
              accessRole: "owner",
              primary: true,
              timeZone: "America/Chicago",
              etag: '"primary"',
            },
            {
              id: "shared@example.test",
              summary: "Vision",
              accessRole: "writer",
              timeZone: "America/Chicago",
              etag: '"shared"',
            },
            {
              id: "other@example.test",
              summary: "Other",
              accessRole: "owner",
              timeZone: "America/Chicago",
              etag: '"other"',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "vision-a@example.test",
              summary: "Vision",
              accessRole: "owner",
              primary: false,
              deleted: false,
              timeZone: "America/Chicago",
              etag: '"vision-a"',
            },
            {
              id: "deleted@example.test",
              summary: "Vision",
              accessRole: "owner",
              deleted: true,
              timeZone: "America/Chicago",
              etag: '"deleted"',
            },
          ],
        }),
      );
    const client = new CalendarClient(TOKEN, SUBJECT, fetcher);

    await expect(client.listOwnedSecondaryCalendars()).resolves.toEqual([
      {
        id: "vision-a@example.test",
        summary: "Vision",
        accessRole: "owner",
        timeZone: "America/Chicago",
        providerEtag: '"vision-a"',
        ownerGoogleSubject: SUBJECT,
      },
    ]);

    expect(fetcher).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(fetcher.mock.calls[0]![0] as string);
    const secondUrl = new URL(fetcher.mock.calls[1]![0] as string);
    expect(firstUrl.pathname).toBe("/calendar/v3/users/me/calendarList");
    expect(firstUrl.searchParams.get("maxResults")).toBe("250");
    expect(firstUrl.searchParams.get("minAccessRole")).toBe("owner");
    expect(firstUrl.searchParams.get("showDeleted")).toBe("false");
    expect(secondUrl.searchParams.get("pageToken")).toBe("page-two");
    expect(fetcher.mock.calls.flatMap((call) => [...call])).not.toContain(
      expect.stringContaining("/events"),
    );
  });

  it("creates only the reviewed secondary-calendar body and verifies by CalendarList stable ID", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          id: "created/id@example.test",
          summary: "Vision",
          timeZone: "America/Chicago",
          etag: '"calendar-resource"',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "created/id@example.test",
          summary: "Vision",
          accessRole: "owner",
          primary: false,
          deleted: false,
          timeZone: "America/Chicago",
          etag: '"calendar-list-entry"',
        }),
      );
    const client = new CalendarClient(TOKEN, SUBJECT, fetcher);

    const created = await client.createSecondaryCalendar("America/Chicago");
    await expect(client.getCalendar(created.id)).resolves.toMatchObject({
      id: "created/id@example.test",
      accessRole: "owner",
      ownerGoogleSubject: SUBJECT,
      providerEtag: '"calendar-list-entry"',
    });

    const createRequest = fetcher.mock.calls[0]![1] as RequestInit;
    expect(fetcher.mock.calls[0]![0]).toBe(
      "https://www.googleapis.com/calendar/v3/calendars",
    );
    expect(createRequest.method).toBe("POST");
    expect(JSON.parse(createRequest.body as string)).toEqual({
      summary: "Vision",
      timeZone: "America/Chicago",
    });
    expect(Object.keys(JSON.parse(createRequest.body as string))).toEqual([
      "summary",
      "timeZone",
    ]);
    expect(fetcher.mock.calls[1]![0]).toBe(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList/created%2Fid%40example.test",
    );
  });

  it("rejects hostile pagination and malformed provider rows with one safe adapter error", async () => {
    const repeatedToken = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        jsonResponse({ nextPageToken: "same", items: [] }),
      );
    const client = new CalendarClient(TOKEN, SUBJECT, repeatedToken);

    await expect(client.listOwnedSecondaryCalendars()).rejects.toEqual(
      expect.objectContaining<Partial<CalendarProviderError>>({
        name: "CalendarProviderError",
        outcome: "definite_failure",
      }),
    );

    const oversized = new CalendarClient(
      TOKEN,
      SUBJECT,
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response("x".repeat(1_048_577), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await expect(oversized.listOwnedSecondaryCalendars()).rejects.toBeInstanceOf(
      CalendarProviderError,
    );
  });

  it("classifies a network failure as an uncertain provider outcome without leaking the token", async () => {
    const client = new CalendarClient(
      TOKEN,
      SUBJECT,
      vi.fn<typeof fetch>().mockRejectedValue(new Error(TOKEN)),
    );

    const error = await client
      .createSecondaryCalendar("America/Chicago")
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CalendarProviderError);
    expect(error).toMatchObject({ outcome: "uncertain" });
    expect(JSON.stringify(error)).not.toContain(TOKEN);
  });

  it("classifies definite 4xx and 429 insert rejections separately from uncertain 5xx", async () => {
    for (const status of [400, 401, 403, 404, 409, 429]) {
      const client = new CalendarClient(
        TOKEN,
        SUBJECT,
        vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, status)),
      );
      await expect(
        client.createSecondaryCalendar("America/Chicago"),
      ).rejects.toMatchObject({ outcome: "definite_failure" });
    }
    const serverFailure = new CalendarClient(
      TOKEN,
      SUBJECT,
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 503)),
    );
    await expect(
      serverFailure.createSecondaryCalendar("America/Chicago"),
    ).rejects.toMatchObject({ outcome: "uncertain" });
  });

  it("bounds never-resolving and slow headers with operation-aware abort classification", async () => {
    for (const mode of ["never", "slow"] as const) {
      let observedSignal: AbortSignal | undefined;
      const fetcher = vi.fn<typeof fetch>().mockImplementation(
        async (_input, init) => {
          observedSignal = init?.signal ?? undefined;
          if (mode === "never") return new Promise<Response>(() => {});
          return new Promise<Response>((resolve) => {
            setTimeout(() => resolve(jsonResponse({ items: [] })), 100);
          });
        },
      );
      const client = new CalendarClient(TOKEN, SUBJECT, fetcher, {
        deadlineMs: 20,
      });

      await expect(client.listOwnedSecondaryCalendars()).rejects.toMatchObject({
        outcome: "definite_failure",
      });
      expect(observedSignal?.aborted).toBe(true);
      expect(JSON.stringify(await client.listOwnedSecondaryCalendars().catch((error) => error))).not.toContain(TOKEN);
    }

    const insert = new CalendarClient(
      TOKEN,
      SUBJECT,
      vi.fn<typeof fetch>().mockImplementation(
        async () => new Promise<Response>(() => {}),
      ),
      { deadlineMs: 20 },
    );
    await expect(
      insert.createSecondaryCalendar("America/Chicago"),
    ).rejects.toMatchObject({ outcome: "uncertain" });
  });

  it("bounds slow, never-ending, and oversized streamed bodies before accumulation", async () => {
    const streamResponse = (
      start: (controller: ReadableStreamDefaultController<Uint8Array>) => void,
    ) =>
      new Response(new ReadableStream<Uint8Array>({ start }), {
        headers: { "content-type": "application/json" },
      });
    const neverEnding = new CalendarClient(
      TOKEN,
      SUBJECT,
      vi.fn<typeof fetch>().mockResolvedValue(
        streamResponse((controller) => {
          controller.enqueue(new TextEncoder().encode('{"items":['));
        }),
      ),
      { deadlineMs: 20 },
    );
    await expect(
      neverEnding.listOwnedSecondaryCalendars(),
    ).rejects.toMatchObject({ outcome: "definite_failure" });

    const slowBody = new CalendarClient(
      TOKEN,
      SUBJECT,
      vi.fn<typeof fetch>().mockResolvedValue(
        streamResponse((controller) => {
          setTimeout(() => {
            controller.enqueue(new TextEncoder().encode('{"items":[]}'));
            controller.close();
          }, 100);
        }),
      ),
      { deadlineMs: 20 },
    );
    await expect(slowBody.getCalendar("vision-id")).rejects.toMatchObject({
      outcome: "definite_failure",
    });

    let cancelled = false;
    const oversized = new CalendarClient(
      TOKEN,
      SUBJECT,
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array(33));
            },
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { "content-type": "application/json" } },
        ),
      ),
      { deadlineMs: 100, maxBodyBytes: 32 },
    );
    await expect(
      oversized.listOwnedSecondaryCalendars(),
    ).rejects.toMatchObject({ outcome: "definite_failure" });
    expect(cancelled).toBe(true);

    const uncertainInsertBody = new CalendarClient(
      TOKEN,
      SUBJECT,
      vi.fn<typeof fetch>().mockResolvedValue(
        streamResponse((controller) => {
          controller.enqueue(new TextEncoder().encode("{"));
        }),
      ),
      { deadlineMs: 20 },
    );
    await expect(
      uncertainInsertBody.createSecondaryCalendar("America/Chicago"),
    ).rejects.toMatchObject({ outcome: "uncertain" });
  });

  it("contains no event-write endpoint in the production adapter source", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/integrations/google-calendar/calendar-client.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(
      /\/events|events\.(?:insert|update|patch|delete)|event(?:Insert|Update|Delete)/u,
    );
  });
});
