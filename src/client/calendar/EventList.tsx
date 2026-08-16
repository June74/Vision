/** Presents synchronized events as a bounded, read-only editorial chronology. */
import type { JSX } from "react";
import type { BrowserSession } from "../setup/api";
import type { FoundationEvent } from "../status/api";
import { CategoryControl } from "./CategoryControl";
import { EventMutationControls } from "./EventMutationControls";
import type { CalendarMutationEvent } from "./writes/api";

type ConcreteDomain = "school" | "work" | "personal";

/** Renders authorized event titles and times with category provenance marginalia. */
export function EventList({
  events,
  session,
  onCategoryChange,
  onMutationVerified,
}: {
  readonly events: readonly FoundationEvent[];
  readonly session: BrowserSession;
  readonly onCategoryChange: (eventId: string, domain: ConcreteDomain) => Promise<void>;
  readonly onMutationVerified: (eventId: string, preview: CalendarMutationEvent | null) => void;
}): JSX.Element {
  if (events.length === 0) {
    return (
      <div className="event-empty">
        <p className="event-empty__title">No synchronized events yet.</p>
        <p>Vision will place Google Calendar events here after the next successful synchronization.</p>
      </div>
    );
  }
  return (
    <ul className="event-ledger" aria-label="Synchronized calendar events">
      {events.map((event, index) => (
        <li className="event-entry" key={event.id}>
          <div className="event-entry__sequence" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </div>
          <time className="event-entry__time" dateTime={event.startsAt}>
            <span>{formatDate(event.startsAt, event.timeZone)}</span>
            <strong>{formatTime(event.startsAt, event.timeZone)}</strong>
            <small>to {formatTime(event.endsAt, event.timeZone)}</small>
          </time>
          <div className="event-entry__body">
            <p className="event-entry__title">{event.title?.trim() || "Untitled event"}</p>
            <p className="event-entry__timezone">{event.timeZone} · {formatEventStatus(event.status)}</p>
          </div>
          <div className="event-entry__actions">
            <CategoryControl
              event={event}
              onChange={(domain) => onCategoryChange(event.id, domain)}
            />
            <EventMutationControls
              event={event}
              session={session}
              onVerified={onMutationVerified}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Formats one calendar day in the event's provider-recorded timezone. */
function formatDate(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone,
    weekday: "short",
  }).format(new Date(value));
}

/** Formats one local event time without converting through the device timezone. */
function formatTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

/** Converts provider status to short display copy while keeping the source fact visible. */
function formatEventStatus(status: FoundationEvent["status"]): string {
  return status.replace(/^\w/u, (letter) => letter.toUpperCase());
}
