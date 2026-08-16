import { describe, expect, it, vi } from "vitest";
import {
  CalendarWriteProviderError,
  type CalendarWriteProvider,
} from "../../../src/domain/calendar-write/create-execution";
import { createGoogleEventWriteClient } from "../../../src/integrations/google-calendar/event-write-client";

const ACCESS_TOKEN = "token_" + "x".repeat(32);
const CALENDAR_ID = "calendar-vision";
const OPERATION_ID = "op-phase-c-002";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function eventPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-001",
    etag: "etag-event-001",
    status: "confirmed",
    summary: "Focus block",
    description: "Protected planning note",
    start: {
      dateTime: "2026-08-17T15:00:00.000Z",
      timeZone: "America/Chicago",
    },
    end: {
      dateTime: "2026-08-17T16:00:00.000Z",
      timeZone: "America/Chicago",
    },
    extendedProperties: {
      private: {
        "vision.operationId": OPERATION_ID,
        "vision.domain": "work",
        "vision.privacy": "private",
      },
    },
    ...overrides,
  };
}

function createInput() {
  return {
    calendarId: CALENDAR_ID,
    operationId: OPERATION_ID,
    title: "Focus block",
    description: "Protected planning note",
    startsAt: "2026-08-17T15:00:00.000Z",
    endsAt: "2026-08-17T16:00:00.000Z",
    timeZone: "America/Chicago",
    domain: "work" as const,
    privacy: "private" as const,
    attendees: [] as const,
    recurrence: null,
    notifications: "none" as const,
  };
}

function clientFor(
  response: Response,
): { readonly client: CalendarWriteProvider; readonly fetcher: ReturnType<typeof vi.fn> } {
  const fetcher = vi.fn(async () => response);
  return {
    fetcher,
    client: createGoogleEventWriteClient({
      accessToken: ACCESS_TOKEN,
      fetcher: fetcher as typeof fetch,
    }),
  };
}

describe("Google one-off event write adapter contract", () => {
  it("reads a bounded calendar ETag from the fixed Calendar API origin", async () => {
    const { client, fetcher } = clientFor(
      jsonResponse({ id: CALENDAR_ID, etag: "etag-calendar-001" }),
    );

    await expect(client.readCalendarVersion(CALENDAR_ID)).resolves.toEqual({
      calendarId: CALENDAR_ID,
      version: "etag-calendar-001",
    });

    const [input, init] = fetcher.mock.calls[0]!;
    expect(String(input)).toBe(
      `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}`,
    );
    expect(init).toMatchObject({
      method: "GET",
      headers: { authorization: `Bearer ${ACCESS_TOKEN}` },
    });
  });

  it("preserves Google-shaped calendar IDs and quoted ETags", async () => {
    const calendarId = "c_vision-123@group.calendar.google.com";
    const { client, fetcher } = clientFor(
      jsonResponse({ id: calendarId, etag: '"etag-calendar-quoted"' }),
    );

    await expect(client.readCalendarVersion(calendarId)).resolves.toEqual({
      calendarId,
      version: '"etag-calendar-quoted"',
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain(
      encodeURIComponent(calendarId),
    );
  });

  it("inserts one no-notification event with private operation markers", async () => {
    const { client, fetcher } = clientFor(jsonResponse(eventPayload()));

    await expect(client.createOneOffEvent(createInput())).resolves.toMatchObject({
      eventId: "event-001",
      version: "etag-event-001",
      operationId: OPERATION_ID,
      notifications: "none",
      recurrence: null,
      attendees: [],
    });

    const [input, init] = fetcher.mock.calls[0]!;
    const url = new URL(String(input));
    expect(url.origin + url.pathname).toBe(
      `https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events`,
    );
    expect(url.searchParams.get("sendUpdates")).toBe("none");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      authorization: `Bearer ${ACCESS_TOKEN}`,
      "content-type": "application/json",
    });
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toEqual({
      summary: "Focus block",
      description: "Protected planning note",
      start: { dateTime: "2026-08-17T15:00:00.000Z", timeZone: "America/Chicago" },
      end: { dateTime: "2026-08-17T16:00:00.000Z", timeZone: "America/Chicago" },
      extendedProperties: {
        private: {
          "vision.operationId": OPERATION_ID,
          "vision.domain": "work",
          "vision.privacy": "private",
        },
      },
    });
    expect(body).not.toHaveProperty("attendees");
    expect(body).not.toHaveProperty("recurrence");
  });

  it("finds only strictly normalized events by the private operation marker", async () => {
    const { client, fetcher } = clientFor(
      jsonResponse({ items: [eventPayload()] }),
    );

    await expect(
      client.findByOperationId({ calendarId: CALENDAR_ID, operationId: OPERATION_ID }),
    ).resolves.toMatchObject([{ eventId: "event-001", operationId: OPERATION_ID }]);

    const [input] = fetcher.mock.calls[0]!;
    const url = new URL(String(input));
    expect(url.pathname).toBe(
      `/calendar/v3/calendars/${CALENDAR_ID}/events`,
    );
    expect(url.searchParams.get("privateExtendedProperty")).toBe(
      `vision.operationId=${OPERATION_ID}`,
    );
    expect(url.searchParams.get("showDeleted")).toBe("false");
    expect(url.searchParams.get("singleEvents")).toBe("false");
  });

  it("rejects a read-back event missing the private operation marker", async () => {
    const { client } = clientFor(
      jsonResponse(
        eventPayload({
          extendedProperties: { private: { "vision.domain": "work", "vision.privacy": "private" } },
        }),
      ),
    );

    await expect(
      client.readEvent({ calendarId: CALENDAR_ID, eventId: "event-001" }),
    ).rejects.toMatchObject({ outcome: "uncertain" });
  });

  it("rejects a read-back event whose start and end time zones differ", async () => {
    const { client } = clientFor(
      jsonResponse(
        eventPayload({
          end: {
            dateTime: "2026-08-17T16:00:00.000Z",
            timeZone: "UTC",
          },
        }),
      ),
    );

    await expect(
      client.readEvent({ calendarId: CALENDAR_ID, eventId: "event-001" }),
    ).rejects.toMatchObject({ outcome: "uncertain" });
  });

  it("deletes with the expected provider version and no notifications", async () => {
    const { client, fetcher } = clientFor(new Response(null, { status: 204 }));

    await expect(
      client.deleteEvent({
        calendarId: CALENDAR_ID,
        eventId: "event-001",
        expectedVersion: "etag-event-001",
      }),
    ).resolves.toBe("deleted");

    const [input, init] = fetcher.mock.calls[0]!;
    const url = new URL(String(input));
    expect(url.searchParams.get("sendUpdates")).toBe("none");
    expect(init).toMatchObject({
      method: "DELETE",
      headers: {
        authorization: `Bearer ${ACCESS_TOKEN}`,
        "if-match": "etag-event-001",
      },
    });
  });

  it("classifies definite and uncertain provider failures without reflecting bodies", async () => {
    const definite = clientFor(new Response("private provider body", { status: 400 }));
    await expect(definite.client.readCalendarVersion(CALENDAR_ID)).rejects.toBeInstanceOf(
      CalendarWriteProviderError,
    );
    await expect(definite.client.readCalendarVersion(CALENDAR_ID)).rejects.toMatchObject({
      outcome: "definite_failure",
    });

    const uncertain = clientFor(new Response("private provider body", { status: 503 }));
    const error = await uncertain.client.createOneOffEvent(createInput()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CalendarWriteProviderError);
    expect(error).toMatchObject({ outcome: "uncertain" });
    expect(JSON.stringify(error)).not.toContain("private provider body");
  });
});
