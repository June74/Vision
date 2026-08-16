/** Renders the authenticated preview, confirmation, and verified-state loop for one event mutation. */
import {
  useState,
  type FormEvent,
  type JSX,
} from "react";
import type { FoundationEvent } from "../status/api";
import type { BrowserSession } from "../setup/api";
import {
  CalendarWriteApiError,
  confirmCalendarEventMutation,
  previewCalendarEventMutation,
  readCalendarEventMutationStatus,
  type CalendarMutationAction,
  type CalendarMutationEvent,
  type CalendarMutationEventPatch,
  type CalendarMutationPreview,
  type CalendarMutationResponse,
} from "./writes/api";

type EditableMutationDraft = {
  readonly action: CalendarMutationAction;
  readonly title: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timeZone: string;
};

type MutationState =
  | { readonly kind: "closed" }
  | { readonly kind: "editing"; readonly draft: EditableMutationDraft }
  | { readonly kind: "preview"; readonly operationId: string; readonly action: CalendarMutationAction; readonly expiresAt: string; readonly preview: CalendarMutationPreview }
  | { readonly kind: "pending"; readonly operationId: string; readonly action: CalendarMutationAction; readonly preview: CalendarMutationPreview }
  | { readonly kind: "verified"; readonly operationId: string; readonly action: CalendarMutationAction; readonly preview: CalendarMutationPreview }
  | { readonly kind: "error"; readonly message: string };

type BusyAction = "preview" | "confirm" | "status" | undefined;

const ACTION_LABELS: Readonly<Record<CalendarMutationAction, string>> = {
  update: "Update details",
  move: "Move time",
  cancel: "Cancel event",
  delete: "Delete event",
};

/** Owns one event's explicit mutation boundary without exposing provider identity or version fields. */
export function EventMutationControls({
  event,
  session,
  onVerified,
}: {
  readonly event: FoundationEvent;
  readonly session: BrowserSession;
  readonly onVerified: (eventId: string, preview: CalendarMutationEvent | null) => void;
}): JSX.Element {
  const [state, setState] = useState<MutationState>({ kind: "closed" });
  const [busy, setBusy] = useState<BusyAction>();
  const controlId = safeControlId(event.id);

  /** Opens a fresh local edit state using the event's current safe projection. */
  function open(): void {
    setState({
      kind: "editing",
      draft: {
        action: "update",
        title: event.title?.trim() ?? "",
        startsAt: toLocalDateTime(event.startsAt, event.timeZone),
        endsAt: toLocalDateTime(event.endsAt, event.timeZone),
        timeZone: event.timeZone,
      },
    });
  }

  /** Updates one local mutation field without contacting the server. */
  function updateDraft<K extends keyof EditableMutationDraft>(
    field: K,
    value: EditableMutationDraft[K],
  ): void {
    setState((current) => current.kind === "editing"
      ? { kind: "editing", draft: { ...current.draft, [field]: value } }
      : current);
  }

  /** Requests the server-derived before/after preview for the selected action. */
  async function preview(event_: FormEvent<HTMLFormElement>): Promise<void> {
    event_.preventDefault();
    if (state.kind !== "editing" || busy) return;
    let after: CalendarMutationEventPatch | null;
    try {
      after = toMutationPatch(state.draft);
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Enter a valid event change." });
      return;
    }
    setBusy("preview");
    try {
      const response = await previewCalendarEventMutation(session, {
        action: state.draft.action,
        eventId: event.id,
        after,
      });
      if (!response.preview || !response.expiresAt) throw new Error("Vision returned an incomplete event change preview.");
      setState({
        kind: "preview",
        operationId: response.operationId,
        action: response.action,
        expiresAt: response.expiresAt,
        preview: response.preview,
      });
    } catch (error) {
      setState({ kind: "error", message: safeErrorMessage(error, "preview") });
    } finally {
      setBusy(undefined);
    }
  }

  /** Confirms the retained preview through the shared verified mutation route. */
  async function confirm(): Promise<void> {
    if (state.kind !== "preview" || busy) return;
    setBusy("confirm");
    try {
      const response = await confirmCalendarEventMutation(session, state.operationId, state.action);
      applyResponse(response, state.preview);
    } catch (error) {
      setState({ kind: "error", message: safeErrorMessage(error, "confirm") });
    } finally {
      setBusy(undefined);
    }
  }

  /** Reads authoritative pending state without issuing another provider mutation. */
  async function checkStatus(): Promise<void> {
    if (state.kind !== "pending" || busy) return;
    setBusy("status");
    try {
      const response = await readCalendarEventMutationStatus(state.operationId);
      applyResponse(response, state.preview);
    } catch (error) {
      setState({ kind: "error", message: safeErrorMessage(error, "status") });
    } finally {
      setBusy(undefined);
    }
  }

  /** Projects one server response into truthful preview, pending, verified, or error state. */
  function applyResponse(
    response: CalendarMutationResponse,
    fallbackPreview?: CalendarMutationPreview,
  ): void {
    const preview = response.preview ?? fallbackPreview;
    if (response.status === "verified" && preview) {
      setState({ kind: "verified", operationId: response.operationId, action: response.action, preview });
      onVerified(event.id, preview.after);
      return;
    }
    if ((response.status === "writing" || response.status === "verification_pending") && preview) {
      setState({ kind: "pending", operationId: response.operationId, action: response.action, preview });
      return;
    }
    if ((response.status === "proposed" || response.status === "confirmed" || response.status === undefined) && preview && response.expiresAt) {
      setState({ kind: "preview", operationId: response.operationId, action: response.action, expiresAt: response.expiresAt, preview });
      return;
    }
    if (response.status === "invalidated" || response.status === "failed") {
      setState({ kind: "error", message: "This event change needs a fresh preview before Vision can continue." });
      return;
    }
    setState({ kind: "error", message: "Vision returned an incomplete event change status." });
  }

  return (
    <section className="event-mutation-control" aria-label="Change calendar event">
      {state.kind === "closed"
        ? <button className="button button--quiet event-mutation-control__launch" type="button" aria-label={`Change event: ${event.title?.trim() || "Untitled event"}`} onClick={open}>Change event</button>
        : null}
      {state.kind === "editing"
        ? (
            <form className="event-mutation-form" onSubmit={(event_) => void preview(event_)}>
              <div className="event-mutation-control__header">
                <p className="event-mutation-control__eyebrow">A deliberate write</p>
                <h4>Change this event</h4>
                <p>Vision will read the current calendar state again before applying one approved change.</p>
              </div>
              <label className="event-mutation-field" htmlFor={`${controlId}-action`}>
                Change type
                <select id={`${controlId}-action`} value={state.draft.action} onChange={(event_) => updateDraft("action", event_.target.value as CalendarMutationAction)}>
                  <option value="update">Update details</option>
                  <option value="move">Move time</option>
                  <option value="cancel">Cancel event</option>
                  <option value="delete">Delete event</option>
                </select>
              </label>
              {state.draft.action === "update"
                ? (
                    <label className="event-mutation-field" htmlFor={`${controlId}-title`}>
                      New title
                      <input id={`${controlId}-title`} required value={state.draft.title} onChange={(event_) => updateDraft("title", event_.target.value)} />
                    </label>
                  )
                : null}
              {state.draft.action === "move"
                ? (
                    <div className="event-mutation-form__times">
                      <label className="event-mutation-field" htmlFor={`${controlId}-start`}>
                        Start
                        <input id={`${controlId}-start`} required type="datetime-local" value={state.draft.startsAt} onChange={(event_) => updateDraft("startsAt", event_.target.value)} />
                      </label>
                      <label className="event-mutation-field" htmlFor={`${controlId}-end`}>
                        End
                        <input id={`${controlId}-end`} required type="datetime-local" value={state.draft.endsAt} onChange={(event_) => updateDraft("endsAt", event_.target.value)} />
                      </label>
                    </div>
                  )
                : null}
              {state.draft.action === "cancel"
                ? <p className="event-mutation-control__note">The event stays in the calendar with a cancelled status.</p>
                : null}
              {state.draft.action === "delete"
                ? <p className="event-mutation-control__note">Deletion is destructive and cannot be undone by Vision.</p>
                : null}
              <div className="one-off-actions">
                <button className="button button--primary" disabled={busy !== undefined} type="submit">{busy === "preview" ? "Preparing preview…" : `Preview ${actionVerb(state.draft.action)}`}</button>
                <button className="button button--quiet" disabled={busy !== undefined} type="button" onClick={() => setState({ kind: "closed" })}>Cancel</button>
              </div>
            </form>
          )
        : null}
      {state.kind === "preview"
        ? (
            <div className="event-mutation-preview">
              <div className="event-mutation-control__header">
                <p className="event-mutation-control__eyebrow">Review before changing Google Calendar</p>
                <h4>Review {actionNoun(state.action)}</h4>
                <p>Nothing has been confirmed. Check both sides of the change, then use the exact confirmation phrase.</p>
              </div>
              <MutationPreviewDetails preview={state.preview} />
              <p className="event-mutation-confirmation">Type/confirm: <strong>{confirmationPhrase(state.action)}</strong></p>
              <div className="one-off-actions">
                <button className="button button--primary" disabled={busy !== undefined} type="button" onClick={() => void confirm()}>{busy === "confirm" ? "Verifying calendar state…" : `Confirm event ${state.action}`}</button>
                <button className="button button--quiet" disabled={busy !== undefined} type="button" onClick={() => setState({ kind: "closed" })}>Start over</button>
              </div>
            </div>
          )
        : null}
      {state.kind === "pending"
        ? (
            <div className="event-mutation-outcome">
              <p className="event-mutation-control__eyebrow">Calendar state is not final yet</p>
              <h4>Verification pending</h4>
              <p>Vision will not issue a second mutation while this operation is unresolved.</p>
              <MutationPreviewDetails preview={state.preview} />
              <div className="one-off-actions">
                <button className="button button--primary" disabled={busy !== undefined} type="button" onClick={() => void checkStatus()}>{busy === "status" ? "Checking status…" : "Check status"}</button>
              </div>
              <p className="one-off-live" role="status">Verification pending</p>
            </div>
          )
        : null}
      {state.kind === "verified"
        ? (
            <div className="event-mutation-outcome">
              <p className="event-mutation-control__eyebrow">Provider read-back matched</p>
              <h4>Verified</h4>
              <p>Vision confirmed the exact {actionNoun(state.action)} and updated this local event view.</p>
              <MutationPreviewDetails preview={state.preview} />
            </div>
          )
        : null}
      {state.kind === "error"
        ? (
            <div className="event-mutation-outcome" role="alert">
              <p className="event-mutation-control__eyebrow">No unverified success claim</p>
              <h4>Event change needs attention</h4>
              <p>{state.message}</p>
              <button className="button button--primary" type="button" onClick={open}>Create a fresh preview</button>
            </div>
          )
        : null}
    </section>
  );
}

/** Shows only the immutable event facts the user approved, including deletion's absent after-state. */
function MutationPreviewDetails({ preview }: { readonly preview: CalendarMutationPreview }): JSX.Element {
  return (
    <div className="event-mutation-preview__facts">
      <div>
        <p className="event-mutation-preview__label">Before</p>
        <MutationEventFacts event={preview.before} />
      </div>
      <div>
        <p className="event-mutation-preview__label">After</p>
        {preview.after
          ? <MutationEventFacts event={preview.after} />
          : <p className="event-mutation-preview__deleted">Event will be deleted.</p>}
      </div>
    </div>
  );
}

/** Presents the bounded fields that distinguish one provider-neutral event snapshot. */
function MutationEventFacts({ event }: { readonly event: CalendarMutationEvent }): JSX.Element {
  return (
    <dl className="event-mutation-preview__list">
      <div><dt>Title</dt><dd>{event.title}</dd></div>
      <div><dt>When</dt><dd>{formatDate(event.startsAt, event.timeZone)} · {formatTime(event.startsAt, event.timeZone)}–{formatTime(event.endsAt, event.timeZone)}</dd></div>
      <div><dt>Time zone</dt><dd>{event.timeZone}</dd></div>
      <div><dt>Status</dt><dd>{capitalize(event.status)}</dd></div>
      <div><dt>Notifications</dt><dd>None</dd></div>
    </dl>
  );
}

/** Converts one editing draft into the server's narrow patch shape. */
function toMutationPatch(draft: EditableMutationDraft): CalendarMutationEventPatch | null {
  if (draft.action === "delete") return null;
  if (draft.action === "cancel") return { status: "cancelled" };
  if (draft.action === "update") {
    if (!draft.title.trim()) throw new Error("Add a title before preparing the preview.");
    return { title: draft.title.trim() };
  }
  const startsAt = localDateTimeToOffsetIso(draft.startsAt, draft.timeZone);
  const endsAt = localDateTimeToOffsetIso(draft.endsAt, draft.timeZone);
  if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error("The event end must be after its start.");
  return { startsAt, endsAt, timeZone: draft.timeZone.trim() };
}

/** Converts a provider timestamp into a wall-clock value for the event's recorded timezone. */
function toLocalDateTime(value: string, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Converts a local wall-clock input into the offset-bearing API timestamp contract. */
function localDateTimeToOffsetIso(value: string, timeZone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(value)) throw new Error("Choose both an event start and end time.");
  const naive = new Date(`${value}:00Z`);
  if (Number.isNaN(naive.getTime())) throw new Error("Choose a valid event time.");
  let parts: Record<string, string> = {};
  try {
    parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(naive).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  } catch {
    throw new Error("Enter a valid IANA time zone, such as America/Chicago.");
  }
  const localAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  const offsetMinutes = Math.round((localAsUtc - naive.getTime()) / 60_000);
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absoluteMinutes = Math.abs(offsetMinutes);
  return `${value}:00${sign}${String(Math.floor(absoluteMinutes / 60)).padStart(2, "0")}:${String(absoluteMinutes % 60).padStart(2, "0")}`;
}

/** Formats one server-returned date in the event's declared timezone. */
function formatDate(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone, weekday: "short" }).format(new Date(value));
}

/** Formats one server-returned time without converting through the device timezone. */
function formatTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(value));
}

/** Returns the exact action phrase shown before confirmation. */
function confirmationPhrase(action: CalendarMutationAction): string {
  if (action === "update") return "CONFIRM EVENT UPDATE";
  if (action === "move") return "CONFIRM EVENT MOVE";
  if (action === "cancel") return "CONFIRM EVENT CANCELLATION";
  return "CONFIRM EVENT DELETE";
}

/** Returns a short sentence-case action noun for headings and status copy. */
function actionNoun(action: CalendarMutationAction): string {
  return ACTION_LABELS[action].replace(/^./u, (letter) => letter.toLowerCase()).replace(/ event$/u, "");
}

/** Returns a concise form action label. */
function actionVerb(action: CalendarMutationAction): string {
  if (action === "update") return "update";
  if (action === "move") return "move";
  if (action === "cancel") return "cancellation";
  return "deletion";
}

/** Converts one event ID into a safe DOM identifier without displaying it. */
function safeControlId(value: string): string {
  return `event-mutation-${value.replace(/[^A-Za-z0-9_-]/gu, "-")}`;
}

/** Converts controlled enum values to sentence-case display copy. */
function capitalize(value: string): string {
  return value.replace(/^\w/u, (letter) => letter.toUpperCase());
}

/** Maps API failures to constant, provider-free guidance. */
function safeErrorMessage(error: unknown, action: "preview" | "confirm" | "status"): string {
  if (error instanceof CalendarWriteApiError && error.status === 409) {
    return "This event changed or could not be verified. Start a fresh preview before trying again.";
  }
  if (error instanceof CalendarWriteApiError && error.status === 503) {
    return "Vision could not reach the calendar. No new event change was confirmed.";
  }
  if (error instanceof CalendarWriteApiError && error.status === 401) {
    return "Your Vision session has expired. Sign in again before changing the event.";
  }
  if (action === "status") return "Vision could not refresh this event change. Try checking status again.";
  return "Vision could not prepare or confirm this event change. No success was assumed.";
}
