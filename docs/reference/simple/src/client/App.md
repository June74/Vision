# `src/client/App.tsx`

## `App`

`App` checks the safe Vision session and calendar connection. It shows setup until the secondary calendar is connected, then opens the read-only calendar desk.

## `loadApp`

Loads sign-in and setup first. Once connected, it asks for event and foundation status information without placing provider credentials in the browser.

## `retryFoundation`

Starts the safe loading sequence again after a visible diagnostics failure.

## `isSignInView`

Chooses whether Vision should show the sign-in or unavailable entry screen.

## `isFoundationView`

Recognizes the connected calendar desk's loading, failure, and ready states.

## `AppHeader`

Shows the Vision wordmark and a short label for the current part of the product.

## `FoundationDesk`

Combines the synchronized event chronology with foundation and AI cost signals.

## `changeCategory`

Saves a category inside Vision and updates that event after the server confirms it.

## `SetupSignalRail`

Shows the current setup state and version without security details.

## `formatSetupState`

Turns a setup state into readable words.
