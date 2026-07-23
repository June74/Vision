/** Renders accessible versioned calendar setup controls and safe creation recovery. */
import { useLayoutEffect, useRef, useState, type JSX } from "react";
import { StatusBanner } from "../status/StatusBanner";
import { confirmCalendarCreation, discoverCalendars, readCalendarSetup, selectCalendar, type BrowserSession, type CalendarSetupSnapshot } from "./api";

const CONFIRMATION_PHRASE = "CREATE VISION CALENDAR";
const OPERATION_STORAGE_KEY = "vision.calendar-setup.active-creation";

/** Retains only the opaque replay context required by a server creation ledger. */
interface ActiveCreation { readonly idempotencyKey: string; readonly setupVersion: number; readonly outcome: "creating" | "retryable" | "action_required" | "definite_failure"; }

/** Shows setup state supplied by App and reports every accepted snapshot back to App. */
export function CalendarSetup({ snapshot, session, onSnapshotChange }: { readonly snapshot: CalendarSetupSnapshot; readonly session: BrowserSession; readonly onSnapshotChange: (snapshot: CalendarSetupSnapshot) => void }): JSX.Element {
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState<"discovering" | "verifying" | "creating" | "reconciling" | undefined>();
  const [problem, setProblem] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const operation = readActiveCreation();
  useLayoutEffect(() => { if (snapshot.status !== "authenticated") panelRef.current?.focus(); }, [snapshot.status, snapshot.setupVersion, pending, problem]);
  /** Runs a truthful pending action and keeps unsafe failures beside the current state. */
  async function run(action: NonNullable<typeof pending>, command: () => Promise<CalendarSetupSnapshot>): Promise<void> { setPending(action); setProblem(false); try { const next = await command(); onSnapshotChange(next); updateOperation(next); } catch { setProblem(true); } finally { setPending(undefined); } }
  /** Starts owned-calendar discovery using the current server version. */
  async function discover(): Promise<void> { await run("discovering", () => discoverCalendars(session, snapshot.setupVersion)); }
  /** Verifies one explicit owned calendar. */
  async function select(calendarId: string): Promise<void> { await run("verifying", () => selectCalendar(session, snapshot.setupVersion, calendarId)); }
  /** Sends exact confirmation once, retaining its original server version and UUID. */
  async function createOrReplay(): Promise<void> { const active = operation ?? startActiveCreation(snapshot.setupVersion); await run(operation ? "reconciling" : "creating", () => confirmCalendarCreation(session, active.setupVersion, active.idempotencyKey)); }
  /** Re-reads server state when storage is absent, without enabling a new creation. */
  async function refresh(): Promise<void> { await run("reconciling", readCalendarSetup); }
  const title = pending === "discovering" ? "Finding your Vision calendars" : pending === "verifying" ? "Verifying your Vision calendar" : pending ? "Calendar request in progress" : snapshot.status === "creating" ? "Calendar request in progress" : snapshot.status === "connected" ? "Vision calendar connected" : snapshot.actionRequired ? "Calendar setup needs attention" : snapshot.status === "awaiting_choice" ? "Choose the Vision calendar to verify" : snapshot.status === "awaiting_confirmation" ? "Create a separate Vision calendar" : "Find your Vision calendar";
  return <section ref={panelRef} role="region" tabIndex={-1} className="setup-card" aria-label="Calendar setup state"><p className="setup-card__eyebrow">Calendar connection</p><h2 id="setup-title">{title}</h2><StatusBanner message={announcement(snapshot, pending, problem)} tone={problem || snapshot.actionRequired ? "warning" : "neutral"} />{renderControls(snapshot, confirmation, setConfirmation, pending, problem, operation, discover, select, createOrReplay, refresh)}</section>;
}

/** Chooses controls and safe copy for the current authoritative setup outcome. */
function renderControls(snapshot: CalendarSetupSnapshot, confirmation: string, setConfirmation: (value: string) => void, pending: string | undefined, problem: boolean, operation: ActiveCreation | undefined, discover: () => Promise<void>, select: (id: string) => Promise<void>, create: () => Promise<void>, refresh: () => Promise<void>): JSX.Element {
  if (pending) return <p>Vision is waiting for this setup request. Keep this page open.</p>;
  if (problem) return <><p>Vision could not confirm this request. No calendar changes were made by the browser.</p><button className="button button--primary" type="button" onClick={() => void (operation ? create() : refresh())}>Try again safely</button></>;
  if (snapshot.status === "connected") return <><StatusBanner message={snapshot.connection?.connectionKind === "existing" ? "Verified existing calendar" : "Verified new secondary calendar"} /><p>{snapshot.connection?.connectionKind === "created" ? "A new secondary Vision calendar was verified with zero events." : "Setup did not add or change any events."}</p></>;
  if (snapshot.status === "creating") return <>{operation ? <button className="button button--primary" type="button" onClick={() => void create()}>Check request status</button> : <button className="button button--primary" type="button" onClick={() => void refresh()}>Refresh setup status</button>}</>;
  if (snapshot.actionRequired) return <p>Review your Vision calendars, then try again. Vision did not make changes automatically.</p>;
  if (snapshot.status === "failed") return operation ? <button className="button button--primary" type="button" onClick={() => void create()}>Try request again</button> : <button className="button button--primary" type="button" onClick={() => void refresh()}>Refresh setup status</button>;
  if (snapshot.status === "awaiting_choice") return <ul className="calendar-list">{snapshot.candidates.map((calendar) => <li key={calendar.calendarId}><button className="calendar-option" type="button" onClick={() => void select(calendar.calendarId)}><span>{calendar.summary}</span><small>{calendar.timeZone}</small><strong>Use {calendar.summary}</strong></button></li>)}</ul>;
  if (snapshot.status === "awaiting_confirmation") return <><p>This creates a secondary calendar named Vision with zero events. Your other calendars stay unchanged.</p><label className="confirmation-label" htmlFor="calendar-confirmation">Type {CONFIRMATION_PHRASE} to confirm</label><input id="calendar-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} /><button className="button button--primary" disabled={confirmation !== CONFIRMATION_PHRASE || !!operation} type="button" onClick={() => void create()}>Create Vision calendar</button></>;
  return <><p>Vision checks only calendars you own. It will not add, change, or remove events during setup.</p><button className="button button--primary" type="button" onClick={() => void discover()}>Find Vision calendars</button></>;
}

/** Returns a concise live announcement for every async setup transition. */
function announcement(snapshot: CalendarSetupSnapshot, pending: string | undefined, problem: boolean): string { if (problem) return "Calendar setup needs attention."; if (pending) return "Calendar setup request in progress."; return snapshot.status.replaceAll("_", " "); }

/** Reads the current opaque operation record without accepting untrusted storage shapes. */
function readActiveCreation(): ActiveCreation | undefined { try { const value = JSON.parse(window.sessionStorage.getItem(OPERATION_STORAGE_KEY) ?? "null") as Partial<ActiveCreation>; return typeof value.idempotencyKey === "string" && Number.isInteger(value.setupVersion) && (value.outcome === "creating" || value.outcome === "retryable" || value.outcome === "action_required" || value.outcome === "definite_failure") ? value as ActiveCreation : undefined; } catch { return undefined; } }

/** Creates one opaque replay record only after the exact confirmation action. */
function startActiveCreation(setupVersion: number): ActiveCreation { const active = { idempotencyKey: crypto.randomUUID(), outcome: "creating" as const, setupVersion }; window.sessionStorage.setItem(OPERATION_STORAGE_KEY, JSON.stringify(active)); return active; }

/** Updates or clears the retained replay record only after an authoritative response. */
function updateOperation(snapshot: CalendarSetupSnapshot): void { const active = readActiveCreation(); if (!active) return; if (snapshot.status === "connected") { window.sessionStorage.removeItem(OPERATION_STORAGE_KEY); return; } const outcome = snapshot.status === "creating" ? "creating" : snapshot.actionRequired ? "action_required" : snapshot.status === "failed" ? "retryable" : active.outcome; window.sessionStorage.setItem(OPERATION_STORAGE_KEY, JSON.stringify({ ...active, outcome })); }
