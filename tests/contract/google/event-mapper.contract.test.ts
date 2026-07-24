import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { GoogleEventMappingError, mapGoogleEvent } from "../../../src/integrations/google-calendar/event-mapper";

const CALENDAR_ID = "vision-secondary-calendar";

function mapInChildTimezone(raw: Record<string, unknown>, timezone: string): "accepted" | "rejected" {
  const mapperUrl = pathToFileURL(
    resolve(process.cwd(), "src/integrations/google-calendar/event-mapper.ts"),
  ).href;
  const script = `import(${JSON.stringify(mapperUrl)}).then(({ mapGoogleEvent }) => { try { mapGoogleEvent(${JSON.stringify(raw)}); process.stdout.write("accepted"); } catch { process.stdout.write("rejected"); } })`;
  return execFileSync(
    process.execPath,
    ["--import", "tsx", "--eval", script],
    { cwd: process.cwd(), env: { ...process.env, TZ: timezone } },
  ).toString() as "accepted" | "rejected";
}

describe("mapGoogleEvent", () => {
  it("maps a normal event into queryable planning data and protected content", () => {
    const change = mapGoogleEvent({
      calendarId: CALENDAR_ID,
      description: "Private planning notes",
      end: { dateTime: "2026-07-24T11:00:00-05:00", timeZone: "America/Chicago" },
      extendedProperties: { private: { visionCategory: "school" } },
      id: "event_1",
      location: "Quiet room",
      sequence: 4,
      start: { dateTime: "2026-07-24T10:00:00-05:00", timeZone: "America/Chicago" },
      status: "confirmed",
      summary: "Deep work",
      transparency: "opaque",
      updated: "2026-07-24T14:01:02.000Z",
      unknownFutureField: { retainedOnlyAtProviderBoundary: true },
    });

    expect(change).toMatchObject({
      type: "upsert",
      identity: {
        sourceCalendarId: CALENDAR_ID,
        sourceEventId: "event_1",
        sourceSystem: "google-calendar",
        sourceVersion: "00000001784901662000",
      },
      startsAt: "2026-07-24T15:00:00.000Z",
      endsAt: "2026-07-24T16:00:00.000Z",
      timeZone: "America/Chicago",
      busy: true,
      status: "confirmed",
      recurrence: { kind: "single" },
      protected: {
        title: "Deep work",
        description: "Private planning notes",
        location: "Quiet room",
      },
    });
    expect(change).not.toHaveProperty("domain");
    expect(change).not.toHaveProperty("category");
  });

  it("maps all-day events to calendar-zone instants and retains the source zone", () => {
    const change = mapGoogleEvent({
      calendarId: CALENDAR_ID,
      end: { date: "2026-07-25", timeZone: "America/Chicago" },
      id: "all_day_1",
      start: { date: "2026-07-24", timeZone: "America/Chicago" },
      status: "confirmed",
      updated: "2026-07-24T14:01:03.000Z",
    });

    expect(change).toMatchObject({
      type: "upsert",
      startsAt: "2026-07-24T05:00:00.000Z",
      endsAt: "2026-07-25T05:00:00.000Z",
      timeZone: "America/Chicago",
    });
  });

  it("rejects all-day dates that do not exist in their IANA timezone", () => {
    expect(() => mapGoogleEvent({
      calendarId: CALENDAR_ID,
      end: { date: "2011-12-31", timeZone: "Pacific/Apia" },
      id: "apia_skip_1",
      start: { date: "2011-12-30", timeZone: "Pacific/Apia" },
      status: "confirmed",
      updated: "2011-12-29T12:00:00.000Z",
    })).toThrow(GoogleEventMappingError);
  });

  it("preserves valid all-day Apia boundaries around the skipped date", () => {
    const change = mapGoogleEvent({
      calendarId: CALENDAR_ID,
      end: { date: "2011-12-31", timeZone: "Pacific/Apia" },
      id: "apia_boundary_1",
      start: { date: "2011-12-29", timeZone: "Pacific/Apia" },
      status: "confirmed",
      updated: "2011-12-29T12:00:00.000Z",
    });

    expect(change).toMatchObject({
      startsAt: "2011-12-29T10:00:00.000Z",
      endsAt: "2011-12-30T10:00:00.000Z",
      timeZone: "Pacific/Apia",
    });
  });

  it("maps an offset-less dateTime using its supplied IANA timezone instead of the Worker timezone", () => {
    const raw = {
      calendarId: CALENDAR_ID,
      end: { dateTime: "2026-07-24T11:00:00", timeZone: "America/Chicago" },
      id: "wall_clock_1",
      start: { dateTime: "2026-07-24T10:00:00", timeZone: "America/Chicago" },
      status: "confirmed",
      updated: "2026-07-24T14:01:03.500Z",
    };
    const mapperUrl = pathToFileURL(
      resolve(process.cwd(), "src/integrations/google-calendar/event-mapper.ts"),
    ).href;
    const script = `import(${JSON.stringify(mapperUrl)}).then(({ mapGoogleEvent }) => process.stdout.write(JSON.stringify(mapGoogleEvent(${JSON.stringify(raw)}))))`;
    const change = JSON.parse(execFileSync(
      process.execPath,
      ["--import", "tsx", "--eval", script],
      { cwd: process.cwd(), env: { ...process.env, TZ: "UTC" } },
    ).toString()) as Record<string, unknown>;

    expect(change).toMatchObject({
      type: "upsert",
      startsAt: "2026-07-24T15:00:00.000Z",
      endsAt: "2026-07-24T16:00:00.000Z",
      timeZone: "America/Chicago",
    });
  });

  it("rejects an offset-less dateTime without the timezone that Google requires", () => {
    expect(() => mapGoogleEvent({
      calendarId: CALENDAR_ID,
      end: { dateTime: "2026-07-24T11:00:00" },
      id: "unqualified_wall_clock_1",
      start: { dateTime: "2026-07-24T10:00:00" },
      status: "confirmed",
      updated: "2026-07-24T14:01:03.750Z",
    })).toThrow(GoogleEventMappingError);
  });

  it("rejects host-dependent and non-RFC3339 provider revision times in every Worker timezone", () => {
    const base = {
      calendarId: CALENDAR_ID,
      end: { dateTime: "2026-07-24T11:00:00Z" },
      id: "revision_1",
      start: { dateTime: "2026-07-24T10:00:00Z" },
      status: "confirmed",
    };
    for (const updated of ["2026-07-24T14:00:00", "Thu, 24 Jul 2026 14:00:00 GMT"]) {
      for (const timezone of ["UTC", "America/Los_Angeles"]) {
        expect(mapInChildTimezone({ ...base, updated }, timezone)).toBe("rejected");
      }
    }
  });

  it("rejects an offset-bearing dateTime that contradicts its supplied IANA timezone", () => {
    expect(() => mapGoogleEvent({
      calendarId: CALENDAR_ID,
      end: { dateTime: "2026-07-24T11:00:00-05:00", timeZone: "America/Los_Angeles" },
      id: "contradictory_zone_1",
      start: { dateTime: "2026-07-24T10:00:00-05:00", timeZone: "America/Los_Angeles" },
      status: "confirmed",
      updated: "2026-07-24T14:01:03.750Z",
    })).toThrow(GoogleEventMappingError);
  });

  it("retains recurring-master and occurrence identities", () => {
    const master = mapGoogleEvent({
      calendarId: CALENDAR_ID,
      end: { dateTime: "2026-07-24T11:00:00Z" },
      id: "series_1",
      recurrence: ["RRULE:FREQ=WEEKLY"],
      start: { dateTime: "2026-07-24T10:00:00Z" },
      status: "confirmed",
      updated: "2026-07-24T14:01:04.000Z",
    });
    const occurrence = mapGoogleEvent({
      calendarId: CALENDAR_ID,
      end: { dateTime: "2026-07-31T11:30:00Z" },
      id: "series_1_20260731",
      originalStartTime: { dateTime: "2026-07-31T10:00:00Z" },
      recurringEventId: "series_1",
      start: { dateTime: "2026-07-31T10:30:00Z" },
      status: "confirmed",
      updated: "2026-07-24T14:01:05.000Z",
    });

    expect(master).toMatchObject({ recurrence: { kind: "master", masterEventId: "series_1" } });
    expect(occurrence).toMatchObject({
      recurrence: {
        kind: "occurrence",
        masterEventId: "series_1",
        originalStartAt: "2026-07-31T10:00:00.000Z",
      },
    });
  });

  it("maps a cancelled occurrence and deleted event as explicit deletions", () => {
    const occurrence = mapGoogleEvent({
      calendarId: CALENDAR_ID,
      id: "series_1_20260731",
      originalStartTime: { dateTime: "2026-07-31T10:00:00Z" },
      recurringEventId: "series_1",
      status: "cancelled",
      updated: "2026-07-24T14:01:06.000Z",
    });
    const deleted = mapGoogleEvent({
      calendarId: CALENDAR_ID,
      id: "deleted_1",
      status: "cancelled",
      updated: "2026-07-24T14:01:07.000Z",
    });

    expect(occurrence).toEqual(expect.objectContaining({ type: "delete", recurrence: expect.objectContaining({ kind: "occurrence", masterEventId: "series_1" }) }));
    expect(deleted).toEqual(expect.objectContaining({ type: "delete", recurrence: { kind: "single" } }));
    expect(occurrence).not.toHaveProperty("protected");
    expect(deleted).not.toHaveProperty("protected");
  });

  it("keeps attendee and meeting data protected and attachment data as references only", () => {
    const change = mapGoogleEvent({
      attachments: [
        { fileId: "attachment_1", fileUrl: "https://files.example.test/attachment_1", mimeType: "application/pdf", title: "Private syllabus" },
      ],
      attendees: [{ displayName: "Private Person", email: "person@example.test" }],
      calendarId: CALENDAR_ID,
      conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://meet.example.test/meeting" }] },
      end: { dateTime: "2026-07-24T11:00:00Z" },
      hangoutLink: "https://hangouts.example.test/legacy",
      id: "private_fields_1",
      start: { dateTime: "2026-07-24T10:00:00Z" },
      status: "confirmed",
      updated: "2026-07-24T14:01:08.000Z",
    });

    expect(change).toEqual(expect.objectContaining({
      type: "upsert",
      protected: expect.objectContaining({
        attendees: ["person@example.test"],
        meetingLinks: ["https://hangouts.example.test/legacy", "https://meet.example.test/meeting"],
        attachmentReferences: [{ id: "attachment_1", url: "https://files.example.test/attachment_1", mimeType: "application/pdf" }],
      }),
    }));
    expect(JSON.stringify(change)).not.toContain("Private syllabus");
    expect(JSON.stringify(change)).not.toContain("Private Person");
  });
});
