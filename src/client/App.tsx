/** Coordinates safe session lookup, calendar setup, and the private foundation desk. */
import { useCallback, useEffect, useState, type JSX } from "react";
import { SignIn, type SignInState } from "./auth/SignIn";
import { EventList } from "./calendar/EventList";
import { OneOffEventComposer } from "./calendar/OneOffEventComposer";
import { CalendarSetup } from "./setup/CalendarSetup";
import {
  readCalendarSetup,
  readSession,
  type BrowserSession,
  type CalendarSetupSnapshot,
} from "./setup/api";
import { CostStatus } from "./status/CostStatus";
import { FoundationStatus } from "./status/FoundationStatus";
import {
  correctEventCategory,
  readFoundationSnapshot,
  type FoundationSnapshot,
} from "./status/api";

/** Displays setup or the authenticated calendar desk without handling provider credentials. */
export function App(): JSX.Element {
  const [view, setView] = useState<AppView>({ kind: "loading" });
  const [loadRevision, setLoadRevision] = useState(0);

  useEffect(() => {
    let active = true;
    /** Loads session and setup first, then the two independent diagnostic reads in parallel. */
    async function loadApp(): Promise<void> {
      const sessionResult = await readSession();
      if (!active) return;
      if (sessionResult.kind !== "authenticated") {
        setView({ kind: sessionResult.kind });
        return;
      }
      try {
        const setup = await readCalendarSetup();
        if (!active) return;
        if (setup.status !== "connected") {
          setView({ kind: "setup", session: sessionResult.session, snapshot: setup });
          return;
        }
        setView({ kind: "foundation_loading", session: sessionResult.session });
        try {
          const snapshot = await readFoundationSnapshot();
          if (active) {
            setView({ kind: "foundation", session: sessionResult.session, snapshot });
          }
        } catch {
          if (active) {
            setView({ kind: "foundation_unavailable", session: sessionResult.session });
          }
        }
      } catch {
        if (active) setView({ kind: "unavailable" });
      }
    }
    void loadApp();
    return () => { active = false; };
  }, [loadRevision]);

  /** Starts a fresh safe session, setup, status, and event read after a visible failure. */
  const retryFoundation = useCallback(() => {
    setView({ kind: "loading" });
    setLoadRevision((revision) => revision + 1);
  }, []);

  if (isFoundationView(view)) {
    return (
      <main className="app-shell app-shell--desk">
        <AppHeader subtitle="Private calendar desk" />
        {view.kind === "foundation"
          ? <FoundationDesk session={view.session} snapshot={view.snapshot} />
          : (
            <div className="desk-layout">
              <section className="desk-surface" aria-label="Vision synchronized calendar">
                {view.kind === "foundation_loading"
                  ? <p className="desk-message" role="status">Opening your calendar…</p>
                  : (
                    <div className="desk-message" role="alert">
                      <p>Vision could not load the latest foundation status.</p>
                      <button className="button button--primary" type="button" onClick={retryFoundation}>Try again</button>
                    </div>
                  )}
              </section>
            </div>
          )}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <AppHeader subtitle="AI Secretary" />
      <div className="setup-layout">
        <section className="setup-surface" aria-label="Vision calendar setup">
          {view.kind === "loading"
            ? <p className="setup-loading" role="status">Checking your Vision session…</p>
            : null}
          {isSignInView(view) ? <SignIn state={view.kind} /> : null}
          {view.kind === "setup"
            ? (
                <CalendarSetup
                  snapshot={view.snapshot}
                  session={view.session}
                  onSnapshotChange={(snapshot) =>
                    setView((current) => current.kind === "setup"
                      ? { ...current, snapshot }
                      : current)}
                />
              )
            : null}
        </section>
        <SetupSignalRail view={view} />
      </div>
    </main>
  );
}

/** Represents the only browser-shell outcomes produced from safe API responses. */
type AppView =
  | { readonly kind: "loading" }
  | { readonly kind: SignInState }
  | { readonly kind: "setup"; readonly session: BrowserSession; readonly snapshot: CalendarSetupSnapshot }
  | { readonly kind: "foundation_loading"; readonly session: BrowserSession }
  | { readonly kind: "foundation_unavailable"; readonly session: BrowserSession }
  | { readonly kind: "foundation"; readonly session: BrowserSession; readonly snapshot: FoundationSnapshot };

/** Narrows a shell outcome to the entry states rendered by SignIn. */
function isSignInView(view: AppView): view is { readonly kind: SignInState } {
  return view.kind === "signed_out" || view.kind === "unavailable";
}

/** Narrows the shell to authenticated connected-calendar loading and display states. */
function isFoundationView(
  view: AppView,
): view is Extract<AppView, { readonly kind: `foundation${string}` }> {
  return view.kind === "foundation" ||
    view.kind === "foundation_loading" ||
    view.kind === "foundation_unavailable";
}

/** Renders Vision's stable wordmark with one view-specific utility label. */
function AppHeader({ subtitle }: { readonly subtitle: string }): JSX.Element {
  return (
    <header className="app-header">
      <p className="app-shell__eyebrow">{subtitle}</p>
      <h1>Vision</h1>
    </header>
  );
}

/** Owns local category presentation while composing the event ledger and quiet signal rail. */
function FoundationDesk({
  session,
  snapshot,
}: {
  readonly session: BrowserSession;
  readonly snapshot: FoundationSnapshot;
}): JSX.Element {
  const [events, setEvents] = useState(snapshot.events);
  /** Persists one explicit correction and replaces only its event's category facts. */
  const changeCategory = useCallback(async (
    eventId: string,
    domain: "school" | "work" | "personal",
  ): Promise<void> => {
    const correction = await correctEventCategory(session, eventId, domain);
    setEvents((current) => current.map((event) =>
      event.id === correction.id
        ? {
            ...event,
            domain: correction.domain,
            domainState: correction.domainState,
            categoryProvenance: correction.categoryProvenance,
          }
        : event));
  }, [session]);
  return (
    <div className="desk-layout">
      <section className="desk-surface" aria-label="Vision synchronized calendar">
        <div className="desk-intro">
          <p className="desk-intro__eyebrow">Synchronized chronology</p>
          <h2>Your calendar, at a glance</h2>
          <p>Read-only events from your connected Vision calendar. Categories are private to Vision.</p>
        </div>
        <OneOffEventComposer session={session} />
        <EventList events={events} onCategoryChange={changeCategory} />
      </section>
      <aside className="desk-signal-rail" aria-label="Calendar foundation status">
        <FoundationStatus status={snapshot.status} />
        <CostStatus status={snapshot.status} />
      </aside>
    </div>
  );
}

/** Displays the signature non-sensitive signal rail for current setup state and version. */
function SetupSignalRail({ view }: { readonly view: AppView }): JSX.Element {
  const state = view.kind === "setup"
    ? formatSetupState(view.snapshot.status)
    : view.kind === "loading"
      ? "Checking"
      : formatSetupState(view.kind);
  const version = view.kind === "setup" ? `v${view.snapshot.setupVersion}` : "—";
  return (
    <aside className="setup-signal" aria-label="Setup signal">
      <p>Setup signal</p>
      <dl>
        <div><dt>State</dt><dd>{state}</dd></div>
        <div><dt>Version</dt><dd>{version}</dd></div>
      </dl>
    </aside>
  );
}

/** Converts an internal setup state label into calm person-facing signal copy. */
function formatSetupState(state: string): string {
  return state.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
