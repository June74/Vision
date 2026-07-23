/** Coordinates safe session lookup and the authenticated Vision calendar setup interface. */
import { useEffect, useState, type JSX } from "react";
import { SignIn, type SignInState } from "./auth/SignIn";
import { CalendarSetup } from "./setup/CalendarSetup";
import { readCalendarSetup, readSession, type BrowserSession, type CalendarSetupSnapshot } from "./setup/api";

/** Displays the private-pilot setup shell without handling provider credentials in the browser. */
export function App(): JSX.Element {
  const [view, setView] = useState<AppView>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    /** Loads only the safe session and versioned setup snapshot needed by the visible controls. */
    async function loadSetup(): Promise<void> {
      const sessionResult = await readSession();
      if (!active) return;
      if (sessionResult.kind !== "authenticated") {
        setView({ kind: sessionResult.kind });
        return;
      }
      try {
        const snapshot = await readCalendarSetup();
        if (active) setView({ kind: "setup", session: sessionResult.session, snapshot });
      } catch {
        if (active) setView({ kind: "unavailable" });
      }
    }
    void loadSetup();
    return () => { active = false; };
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header"><p className="app-shell__eyebrow">AI Secretary</p><h1>Vision</h1></header>
      <div className="setup-layout">
        <section className="setup-surface" aria-label="Vision calendar setup">
          {view.kind === "loading" ? <p className="setup-loading" role="status">Checking your Vision session…</p> : null}
          {isSignInView(view) ? <SignIn state={view.kind} /> : null}
          {view.kind === "setup" ? <CalendarSetup initialSnapshot={view.snapshot} session={view.session} /> : null}
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
  | { readonly kind: "setup"; readonly session: BrowserSession; readonly snapshot: CalendarSetupSnapshot };

/** Narrows a shell outcome to the entry states rendered by SignIn. */
function isSignInView(view: AppView): view is { readonly kind: SignInState } {
  return view.kind === "signed_out" || view.kind === "access_denied" || view.kind === "unavailable";
}

/** Displays the signature non-sensitive signal rail for current setup state and version. */
function SetupSignalRail({ view }: { readonly view: AppView }): JSX.Element {
  const state = view.kind === "setup" ? formatSetupState(view.snapshot.status) : view.kind === "loading" ? "Checking" : formatSetupState(view.kind);
  const version = view.kind === "setup" ? `v${view.snapshot.setupVersion}` : "—";
  return <aside className="setup-signal" aria-label="Setup signal"><p>Setup signal</p><dl><div><dt>State</dt><dd>{state}</dd></div><div><dt>Version</dt><dd>{version}</dd></div></dl></aside>;
}

/** Converts an internal setup state label into calm person-facing signal copy. */
function formatSetupState(state: string): string {
  return state.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
