/** Renders safe sign-in, access-denied, and unavailable entry states for Vision. */
import type { JSX } from "react";

/** Identifies the non-authenticated state the browser shell needs to explain. */
export type SignInState = "access_denied" | "signed_out" | "unavailable";

/** Displays one safe session-entry state and never receives or stores provider credentials. */
export function SignIn({ state }: { readonly state: SignInState }): JSX.Element {
  if (state === "access_denied") {
    return (
      <section className="setup-card" aria-labelledby="access-denied-title">
        <p className="setup-card__eyebrow">Private pilot</p>
        <h2 id="access-denied-title">Access denied</h2>
        <p>This Google account is not allowed to use Vision. Sign in with the approved account to continue.</p>
      </section>
    );
  }
  if (state === "unavailable") {
    return (
      <section className="setup-card" aria-labelledby="session-unavailable-title">
        <p className="setup-card__eyebrow">Private pilot</p>
        <h2 id="session-unavailable-title">Vision is temporarily unavailable</h2>
        <p>Your calendar setup has not changed. Refresh this page to try again.</p>
      </section>
    );
  }
  return (
    <section className="setup-card" aria-labelledby="sign-in-title">
      <p className="setup-card__eyebrow">Private AI secretary</p>
      <h2 id="sign-in-title">Start with your approved Google account</h2>
      <p>Setup creates a secondary Vision calendar with zero events.</p>
      <button className="button button--primary" type="button" onClick={startGoogleSignIn}>
        Sign in with Google
      </button>
    </section>
  );
}

/** Starts the server-owned Google authorization flow without placing credentials in browser storage. */
function startGoogleSignIn(): void {
  window.location.assign("/api/auth/google/start");
}
