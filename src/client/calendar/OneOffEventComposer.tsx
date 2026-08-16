/** Renders the guarded one-off event preview, confirmation, verification, and undo loop. */
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type JSX,
} from "react";
import type { BrowserSession } from "../setup/api";
import {
  CalendarWriteApiError,
  confirmOneOffEvent,
  previewOneOffEvent,
  readOneOffEventStatus,
  undoOneOffEvent,
  type CalendarWriteDomain,
  type CalendarWritePreview,
  type CalendarWritePrivacy,
  type CalendarWriteResponse,
  type CalendarWriteStatus,
  type OneOffEventDraft,
} from "./writes/api";

const OPERATION_STORAGE_KEY = "vision.calendar-write.active-operation";

type EditableDraft = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  domain: CalendarWriteDomain;
  privacy: CalendarWritePrivacy;
};

type ComposerState =
  | { readonly kind: "closed" }
  | { readonly kind: "editing"; readonly draft: EditableDraft }
  | { readonly kind: "preview"; readonly operationId: string; readonly expiresAt: string; readonly preview: CalendarWritePreview }
  | { readonly kind: "pending"; readonly operationId: string; readonly preview: CalendarWritePreview }
  | { readonly kind: "verified"; readonly operationId: string; readonly preview: CalendarWritePreview }
  | { readonly kind: "undone" }
  | { readonly kind: "error"; readonly message: string };

type BusyAction = "preview" | "confirm" | "status" | "undo" | undefined;

const DEFAULT_DRAFT: EditableDraft = {
  title: "",
  description: "",
  startsAt: "",
  endsAt: "",
  timeZone: "America/Chicago",
  domain: "personal",
  privacy: "private",
};

/** Gives the connected desk one deliberately small, explicit calendar-write entry point. */
export function OneOffEventComposer({ session }: { readonly session: BrowserSession }): JSX.Element {
  const [state, setState] = useState<ComposerState>({ kind: "closed" });
  const [busy, setBusy] = useState<BusyAction>();

  useEffect(() => {
    let active = true;
    const stored = readStoredOperation();
    if (!stored) return () => { active = false; };
    void readOneOffEventStatus(stored.operationId)
      .then((response) => {
        if (active) applyResponse(response);
      })
      .catch(() => {
        if (active) setState({ kind: "error", message: "Vision could not recover this one-off event. Start a new preview." });
      });
    return () => { active = false; };
  }, []);

  function openComposer(): void {
    setState({ kind: "editing", draft: DEFAULT_DRAFT });
  }

  function updateDraft<K extends keyof EditableDraft>(field: K, value: EditableDraft[K]): void {
    setState((current) => current.kind === "editing"
      ? { kind: "editing", draft: { ...current.draft, [field]: value } }
      : current);
  }

  async function preview(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (state.kind !== "editing" || busy) return;
    let draft: OneOffEventDraft;
    try {
      draft = toApiDraft(state.draft);
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Enter a valid one-off event." });
      return;
    }
    setBusy("preview");
    try {
      const response = await previewOneOffEvent(session, draft);
      if (!response.preview || !response.expiresAt) throw new Error("Vision returned an incomplete preview.");
      storeOperation(response.operationId, "proposed");
      setState({
        kind: "preview",
        operationId: response.operationId,
        expiresAt: response.expiresAt,
        preview: response.preview,
      });
    } catch (error) {
      setState({ kind: "error", message: safeErrorMessage(error, "preview") });
    } finally {
      setBusy(undefined);
    }
  }

  async function confirm(): Promise<void> {
    if (state.kind !== "preview" || busy) return;
    setBusy("confirm");
    try {
      const response = await confirmOneOffEvent(session, state.operationId);
      applyResponse(response, state.preview, state.expiresAt);
    } catch (error) {
      setState({ kind: "error", message: safeErrorMessage(error, "confirm") });
    } finally {
      setBusy(undefined);
    }
  }

  async function checkStatus(): Promise<void> {
    if (state.kind !== "pending" || busy) return;
    setBusy("status");
    try {
      const response = await readOneOffEventStatus(state.operationId);
      applyResponse(response, state.preview);
    } catch (error) {
      setState({ kind: "error", message: safeErrorMessage(error, "status") });
    } finally {
      setBusy(undefined);
    }
  }

  async function undo(): Promise<void> {
    if (state.kind !== "verified" || busy) return;
    setBusy("undo");
    try {
      const response = await undoOneOffEvent(session, state.operationId);
      if (response.status === "undone") {
        clearStoredOperation();
        setState({ kind: "undone" });
      } else if (response.status === "verification_pending") {
        storeOperation(state.operationId, "verification_pending");
        setState({ kind: "pending", operationId: state.operationId, preview: state.preview });
      } else {
        setState({ kind: "error", message: "Vision could not verify that the event was removed. Check status before trying again." });
      }
    } catch (error) {
      setState({ kind: "error", message: safeErrorMessage(error, "undo") });
    } finally {
      setBusy(undefined);
    }
  }

  function applyResponse(
    response: CalendarWriteResponse,
    fallbackPreview?: CalendarWritePreview,
    fallbackExpiresAt?: string,
  ): void {
    const preview = response.preview ?? fallbackPreview;
    if (response.status === "verified" && preview) {
      storeOperation(response.operationId, "verified");
      setState({ kind: "verified", operationId: response.operationId, preview });
      return;
    }
    if ((response.status === "writing" || response.status === "verification_pending") && preview) {
      storeOperation(response.operationId, "verification_pending");
      setState({ kind: "pending", operationId: response.operationId, preview });
      return;
    }
    if ((response.status === "proposed" || response.status === "confirmed") && preview && response.expiresAt) {
      storeOperation(response.operationId, response.status);
      setState({ kind: "preview", operationId: response.operationId, expiresAt: response.expiresAt, preview });
      return;
    }
    if (response.status === "undone") {
      clearStoredOperation();
      setState({ kind: "undone" });
      return;
    }
    if (response.status === "invalidated" || response.status === "failed") {
      clearStoredOperation();
      setState({ kind: "error", message: "This one-off event needs a fresh preview before Vision can continue." });
      return;
    }
    if (preview && fallbackExpiresAt) {
      setState({ kind: "preview", operationId: response.operationId, expiresAt: fallbackExpiresAt, preview });
      return;
    }
    setState({ kind: "error", message: "Vision returned an incomplete one-off event status." });
  }

  return (
    <section className="one-off-composer" aria-label="One-off event">
      {state.kind === "closed"
        ? (
            <div className="one-off-composer__launch">
              <div>
                <p className="one-off-composer__eyebrow">A deliberate write</p>
                <h3>One-off event</h3>
                <p>Add one private, notification-free event after reviewing exactly what Vision will send.</p>
              </div>
              <button className="button button--primary" type="button" onClick={openComposer}>Add one-off event</button>
            </div>
          )
        : null}
      {state.kind === "editing"
        ? (
            <form className="one-off-form" onSubmit={(event) => void preview(event)}>
              <div className="one-off-composer__header">
                <p className="one-off-composer__eyebrow">A deliberate write</p>
                <h3 id="one-off-event-title">Plan a one-off event</h3>
                <p>Vision will keep this event one-off, private, and notification-free.</p>
              </div>
              <div className="one-off-form__grid">
                <label className="one-off-field one-off-field--wide" htmlFor="one-off-title">
                  Title
                  <input id="one-off-title" required value={state.draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
                </label>
                <label className="one-off-field one-off-field--wide" htmlFor="one-off-description">
                  Description <span>(optional)</span>
                  <textarea id="one-off-description" value={state.draft.description} onChange={(event) => updateDraft("description", event.target.value)} />
                </label>
                <label className="one-off-field" htmlFor="one-off-start">
                  Start
                  <input id="one-off-start" required type="datetime-local" value={state.draft.startsAt} onChange={(event) => updateDraft("startsAt", event.target.value)} />
                </label>
                <label className="one-off-field" htmlFor="one-off-end">
                  End
                  <input id="one-off-end" required type="datetime-local" value={state.draft.endsAt} onChange={(event) => updateDraft("endsAt", event.target.value)} />
                </label>
                <label className="one-off-field one-off-field--wide" htmlFor="one-off-time-zone">
                  Time zone
                  <input id="one-off-time-zone" required value={state.draft.timeZone} onChange={(event) => updateDraft("timeZone", event.target.value)} />
                </label>
                <label className="one-off-field" htmlFor="one-off-domain">
                  Domain
                  <select id="one-off-domain" value={state.draft.domain} onChange={(event) => updateDraft("domain", event.target.value as CalendarWriteDomain)}>
                    <option value="personal">Personal</option>
                    <option value="school">School</option>
                    <option value="work">Work</option>
                  </select>
                </label>
                <label className="one-off-field" htmlFor="one-off-privacy">
                  Privacy
                  <select id="one-off-privacy" value={state.draft.privacy} onChange={(event) => updateDraft("privacy", event.target.value as CalendarWritePrivacy)}>
                    <option value="private">Private</option>
                    <option value="planning">Planning</option>
                    <option value="restricted">Restricted</option>
                  </select>
                </label>
              </div>
              <div className="one-off-actions">
                <button className="button button--primary" disabled={busy !== undefined} type="submit">{busy === "preview" ? "Preparing preview…" : "Preview event"}</button>
                <button className="button button--quiet" disabled={busy !== undefined} type="button" onClick={() => setState({ kind: "closed" })}>Cancel</button>
                <button className="button button--quiet" disabled type="button">Confirm one-off event</button>
              </div>
            </form>
          )
        : null}
      {state.kind === "preview"
        ? (
            <div className="one-off-preview">
              <div className="one-off-composer__header">
                <p className="one-off-composer__eyebrow">Review before changing Google Calendar</p>
                <h3>Review this one-off event</h3>
                <p>Nothing has been confirmed. Check the exact event facts, then choose the explicit confirmation.</p>
              </div>
              <PreviewDetails preview={state.preview} expiresAt={state.expiresAt} />
              <div className="one-off-actions">
                <button className="button button--primary" disabled={busy !== undefined} type="button" onClick={() => void confirm()}>{busy === "confirm" ? "Verifying calendar state…" : "Confirm one-off event"}</button>
                <button className="button button--quiet" disabled={busy !== undefined} type="button" onClick={() => setState({ kind: "closed" })}>Start over</button>
              </div>
            </div>
          )
        : null}
      {state.kind === "pending"
        ? (
            <div className="one-off-outcome">
              <p className="one-off-composer__eyebrow">Calendar state is not final yet</p>
              <h3>Verification pending</h3>
              <p>Vision is checking the calendar state. It will not issue a second create request while this operation is unresolved.</p>
              <PreviewDetails preview={state.preview} />
              <div className="one-off-actions">
                <button className="button button--primary" disabled={busy !== undefined} type="button" onClick={() => void checkStatus()}>{busy === "status" ? "Checking status…" : "Check status"}</button>
              </div>
              <p className="one-off-live" role="status">Verification pending</p>
            </div>
          )
        : null}
      {state.kind === "verified"
        ? (
            <div className="one-off-outcome">
              <p className="one-off-composer__eyebrow">Provider read-back matched</p>
              <h3>Verified</h3>
              <p>Vision confirmed the exact one-off event and retained its protected undo boundary.</p>
              <PreviewDetails preview={state.preview} />
              <div className="one-off-actions">
                <button className="button button--quiet" disabled={busy !== undefined} type="button" onClick={() => void undo()}>{busy === "undo" ? "Verifying removal…" : "Undo this event"}</button>
              </div>
            </div>
          )
        : null}
      {state.kind === "undone"
        ? (
            <div className="one-off-outcome">
              <p className="one-off-composer__eyebrow">Compensating action verified</p>
              <h3>Undone</h3>
              <p>Vision verified that the one-off event is no longer present in the connected calendar.</p>
              <p className="one-off-live" role="status">Undone</p>
              <button className="button button--primary" type="button" onClick={openComposer}>Add another one-off event</button>
            </div>
          )
        : null}
      {state.kind === "error"
        ? (
            <div className="one-off-outcome" role="alert">
              <p className="one-off-composer__eyebrow">No unverified success claim</p>
              <h3>One-off event needs attention</h3>
              <p>{state.message}</p>
              <button className="button button--primary" type="button" onClick={openComposer}>Create a fresh preview</button>
            </div>
          )
        : null}
    </section>
  );
}

/** Presents the immutable server preview without displaying provider-only fields. */
function PreviewDetails({
  preview,
  expiresAt,
}: {
  readonly preview: CalendarWritePreview;
  readonly expiresAt?: string;
}): JSX.Element {
  const event = preview.after;
  return (
    <dl className="one-off-preview__facts">
      <div><dt>Title</dt><dd>{event.title}</dd></div>
      <div><dt>When</dt><dd>{formatPreviewDate(event.startsAt, event.timeZone)} · {formatPreviewTime(event.startsAt, event.timeZone)}–{formatPreviewTime(event.endsAt, event.timeZone)}</dd></div>
      <div><dt>Time zone</dt><dd>{event.timeZone}</dd></div>
      <div><dt>Domain</dt><dd>{capitalize(event.domain)}</dd></div>
      <div><dt>Privacy</dt><dd>{capitalize(event.privacy)}</dd></div>
      <div><dt>Attendees</dt><dd>None</dd></div>
      <div><dt>Notifications</dt><dd>None</dd></div>
      {expiresAt ? <div><dt>Review window</dt><dd>{formatPreviewDate(expiresAt, "UTC")} UTC</dd></div> : null}
    </dl>
  );
}

function toApiDraft(draft: EditableDraft): OneOffEventDraft {
  if (!draft.title.trim()) throw new Error("Add a title before preparing the preview.");
  const startsAt = localDateTimeToOffsetIso(draft.startsAt, draft.timeZone);
  const endsAt = localDateTimeToOffsetIso(draft.endsAt, draft.timeZone);
  if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error("The event end must be after its start.");
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    startsAt,
    endsAt,
    timeZone: draft.timeZone.trim(),
    domain: draft.domain,
    privacy: draft.privacy,
  };
}

/** Converts a local wall-clock input into the server's offset-bearing timestamp contract. */
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
  const localAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMinutes = Math.round((localAsUtc - naive.getTime()) / 60_000);
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
  const minutes = String(absoluteMinutes % 60).padStart(2, "0");
  return `${value}:00${sign}${hours}:${minutes}`;
}

function formatPreviewDate(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone,
    weekday: "short",
  }).format(new Date(value));
}

function formatPreviewTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

function capitalize(value: string): string {
  return value.replace(/^\w/u, (letter) => letter.toUpperCase());
}

function safeErrorMessage(error: unknown, action: "preview" | "confirm" | "status" | "undo"): string {
  if (error instanceof CalendarWriteApiError && error.status === 409) {
    return action === "undo"
      ? "Vision could not verify that the event was removed. Check status before trying again."
      : "This one-off event needs a fresh preview before Vision can continue.";
  }
  if (error instanceof CalendarWriteApiError && error.status === 503) {
    return "Vision could not reach the calendar. No new event was confirmed.";
  }
  return action === "undo"
    ? "Vision could not verify that the event was removed. Try again after checking status."
    : "Vision could not complete this request. No new event was confirmed.";
}

function storeOperation(operationId: string, status: CalendarWriteStatus): void {
  try {
    window.sessionStorage.setItem(OPERATION_STORAGE_KEY, JSON.stringify({ operationId, status }));
  } catch {
    // Recovery is helpful but never an authority-bearing dependency.
  }
}

function clearStoredOperation(): void {
  try {
    window.sessionStorage.removeItem(OPERATION_STORAGE_KEY);
  } catch {
    // Storage failure must not turn a verified server result into a false failure.
  }
}

function readStoredOperation(): { readonly operationId: string; readonly status: CalendarWriteStatus } | undefined {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(OPERATION_STORAGE_KEY) ?? "null") as {
      readonly operationId?: unknown;
      readonly status?: unknown;
    } | null;
    return typeof value?.operationId === "string" && isCalendarWriteStatus(value.status)
      ? { operationId: value.operationId, status: value.status }
      : undefined;
  } catch {
    return undefined;
  }
}

function isCalendarWriteStatus(value: unknown): value is CalendarWriteStatus {
  return typeof value === "string" && [
    "proposed",
    "confirmed",
    "writing",
    "verification_pending",
    "verified",
    "failed",
    "undone",
    "invalidated",
  ].includes(value);
}
