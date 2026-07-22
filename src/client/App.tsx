/** Renders the initial Vision browser shell. */
import type { JSX } from "react";

/** Displays the minimal visible status for the Vision foundation. */
export function App(): JSX.Element {
  return (
    <main className="app-shell">
      <p className="app-shell__eyebrow">AI Secretary</p>
      <h1>Vision</h1>
      <p>Foundation status</p>
    </main>
  );
}
