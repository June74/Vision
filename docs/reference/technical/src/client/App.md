# `src/client/App.tsx`

## `App`

**Signature:** `App(): JSX.Element`

`App` owns a finite safe-view state machine. It reads the authenticated session, then setup, and only reads diagnostics for an already-connected calendar. A primitive revision counter retries the whole admission path. The browser receives no provider token or encrypted field.

## `loadApp`

Reads session and setup sequentially because each is an admission boundary. It then delegates concurrent event/status reads to `readFoundationSnapshot`, guards every async state update against unmount, and maps failures to safe UI states.

## `retryFoundation`

Uses a functional state update to increment the primitive load revision, avoiding an unstable effect dependency.

## `isSignInView`

Narrows `AppView` to signed-out and unavailable entry outcomes.

## `isFoundationView`

Narrows `AppView` to connected-calendar loading, unavailable, and ready variants before desk rendering.

## `AppHeader`

**Signature:** `AppHeader({ subtitle }): JSX.Element`

Renders static brand structure with view-specific utility copy.

## `FoundationDesk`

**Signature:** `FoundationDesk({ session, snapshot }): JSX.Element`

Owns local event presentation after the initial safe snapshot and composes `EventList`, `FoundationStatus`, and `CostStatus`. Its callback is stable for a given session.

## `changeCategory`

Calls the authenticated CSRF-protected correction API, then functionally replaces only the matching event's allowlisted category facts.

## `SetupSignalRail`

Displays setup state/version only and excludes account, calendar identifier, token, and provider internals.

## `formatSetupState`

Converts status enum text to presentation copy without changing stored state.
