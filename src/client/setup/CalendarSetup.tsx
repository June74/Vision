/** Renders the authenticated calendar setup controls using only safe server snapshots. */
import { useRef, useState, type JSX } from "react";
import { StatusBanner } from "../status/StatusBanner";
import {
  confirmCalendarCreation,
  discoverCalendars,
  selectCalendar,
  type BrowserSession,
  type CalendarSetupSnapshot,
} from "./api";

const CONFIRMATION_PHRASE = "CREATE VISION CALENDAR";

/** Shows the authenticated setup state and submits only versioned, CSRF-protected setup commands. */
export function CalendarSetup({ initialSnapshot, session }: { readonly initialSnapshot: CalendarSetupSnapshot; readonly session: BrowserSession }): JSX.Element {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [requestProblem, setRequestProblem] = useState(false);
  const inFlight = useRef(false);
  const idempotencyKey = useRef(readCreationKey(initialSnapshot.setupVersion));
  const actionRequired = snapshot.actionRequired || (snapshot.status === "failed" && snapshot.retryable === false);

  /** Runs discovery again after a safe retryable failure. */
  async function handleDiscovery(): Promise<void> {
    await runCommand(() => discoverCalendars(session, snapshot.setupVersion));
  }

  /** Sends the explicit selected calendar ID to the verification route. */
  async function handleSelection(calendarId: string): Promise<void> {
    await runCommand(() => selectCalendar(session, snapshot.setupVersion, calendarId));
  }

  /** Creates or reconciles once with a stable same-version idempotency key. */
  async function handleCreation(): Promise<void> {
    if (confirmation !== CONFIRMATION_PHRASE || inFlight.current) return;
    await runCommand(() => confirmCalendarCreation(session, snapshot.setupVersion, idempotencyKey.current));
  }

  /** Applies one server snapshot while preventing concurrent duplicate setup mutations. */
  async function runCommand(command: () => Promise<CalendarSetupSnapshot>): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setRequestProblem(false);
    try {
      const nextSnapshot = await command();
      setSnapshot(nextSnapshot);
      if (nextSnapshot.setupVersion !== initialSnapshot.setupVersion) {
        idempotencyKey.current = readCreationKey(nextSnapshot.setupVersion);
      }
    } catch {
      setRequestProblem(true);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  if (pending || snapshot.status === "creating") return <CreatingState />;
  if (snapshot.status === "connected" && snapshot.connection) return <ConnectedState snapshot={snapshot} />;
  if (actionRequired) return <ActionRequiredState />;
  if (snapshot.status === "awaiting_choice") return <ChoiceState candidates={snapshot.candidates} onSelect={handleSelection} />;
  if (snapshot.status === "awaiting_confirmation") {
    return <ConfirmationState confirmation={confirmation} onChange={setConfirmation} onCreate={handleCreation} />;
  }
  if (snapshot.status === "failed" || requestProblem) return <RetryState onRetry={handleDiscovery} />;
  return <DiscoveryState onDiscover={handleDiscovery} />;
}

/** Displays the intentional first step before Vision checks owned secondary calendars. */
function DiscoveryState({ onDiscover }: { readonly onDiscover: () => Promise<void> }): JSX.Element {
  return (
    <section className="setup-card" aria-labelledby="discover-title">
      <p className="setup-card__eyebrow">Calendar connection</p>
      <h2 id="discover-title">Find your Vision calendar</h2>
      <p>Vision checks only calendars you own. It will not add, change, or remove events during setup.</p>
      <button className="button button--primary" type="button" onClick={() => void onDiscover()}>Find Vision calendars</button>
    </section>
  );
}

/** Offers each discovered owned calendar as an explicit verification choice. */
function ChoiceState({ candidates, onSelect }: { readonly candidates: readonly { readonly calendarId: string; readonly summary: string; readonly timeZone: string }[]; readonly onSelect: (calendarId: string) => Promise<void> }): JSX.Element {
  return (
    <section className="setup-card" aria-labelledby="choice-title">
      <p className="setup-card__eyebrow">Owned calendars found</p>
      <h2 id="choice-title">Choose the Vision calendar to verify</h2>
      <p>Choose one calendar you own. Vision will verify it before connecting.</p>
      <ul className="calendar-list">
        {candidates.map((calendar) => <li key={calendar.calendarId}><button className="calendar-option" type="button" onClick={() => void onSelect(calendar.calendarId)}><span>{calendar.summary}</span><small>{calendar.timeZone}</small><strong>Use {calendar.summary}</strong></button></li>)}
      </ul>
    </section>
  );
}

/** Requires an exact phrase before a secondary zero-event calendar can be created. */
function ConfirmationState({ confirmation, onChange, onCreate }: { readonly confirmation: string; readonly onChange: (value: string) => void; readonly onCreate: () => Promise<void> }): JSX.Element {
  return (
    <section className="setup-card" aria-labelledby="confirmation-title">
      <p className="setup-card__eyebrow">New calendar</p>
      <h2 id="confirmation-title">Create a separate Vision calendar</h2>
      <p>This creates a secondary calendar named Vision with zero events. Your other calendars stay unchanged.</p>
      <label className="confirmation-label" htmlFor="calendar-confirmation">Type {CONFIRMATION_PHRASE} to confirm</label>
      <input id="calendar-confirmation" value={confirmation} onChange={(event) => onChange(event.target.value)} autoComplete="off" spellCheck={false} />
      <button className="button button--primary" disabled={confirmation !== CONFIRMATION_PHRASE} type="button" onClick={() => void onCreate()}>Create Vision calendar</button>
    </section>
  );
}

/** Explains that Vision is waiting for the versioned creation response. */
function CreatingState(): JSX.Element {
  return <section className="setup-card" aria-labelledby="creating-title"><p className="setup-card__eyebrow">Calendar connection</p><h2 id="creating-title">Creating your Vision calendar</h2><StatusBanner message="Vision is confirming the calendar. Keep this page open." /></section>;
}

/** Confirms a verified connection without displaying sensitive provider identifiers. */
function ConnectedState({ snapshot }: { readonly snapshot: CalendarSetupSnapshot }): JSX.Element {
  const existing = snapshot.connection?.connectionKind === "existing";
  return <section className="setup-card" aria-labelledby="connected-title"><p className="setup-card__eyebrow">Calendar connection</p><h2 id="connected-title">Vision calendar connected</h2><StatusBanner message={existing ? "Verified existing calendar" : "Verified new secondary calendar"} /><p>Vision is connected to a secondary calendar with zero events.</p></section>;
}

/** Guides ambiguous provider results to a review instead of unsafe automatic repetition. */
function ActionRequiredState(): JSX.Element {
  return <section className="setup-card" aria-labelledby="action-required-title"><p className="setup-card__eyebrow">Calendar connection</p><h2 id="action-required-title">Calendar setup needs attention</h2><StatusBanner message="Review your Vision calendars, then try again." tone="warning" /><p>Vision did not make changes automatically.</p></section>;
}

/** Offers a safe retry path after a transient setup response. */
function RetryState({ onRetry }: { readonly onRetry: () => Promise<void> }): JSX.Element {
  return <section className="setup-card" aria-labelledby="retry-title"><p className="setup-card__eyebrow">Calendar connection</p><h2 id="retry-title">Calendar setup is paused</h2><StatusBanner message="Vision could not confirm the calendar yet. Try again." tone="warning" /><button className="button button--primary" type="button" onClick={() => void onRetry()}>Try setup again</button></section>;
}

/** Reads or creates a same-version UUID without storing a token or any provider response. */
function readCreationKey(setupVersion: number): string {
  const keyName = `vision.calendar-setup.create.${setupVersion}`;
  const storedKey = window.sessionStorage.getItem(keyName);
  if (storedKey) return storedKey;
  const generatedKey = crypto.randomUUID();
  window.sessionStorage.setItem(keyName, generatedKey);
  return generatedKey;
}
