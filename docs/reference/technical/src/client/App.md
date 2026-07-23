# `src/client/App.tsx`

## `App`

**Signature:** `App(): JSX.Element`

`App` performs safe session and setup reads, then composes session entry, calendar setup, and a non-sensitive state/version rail. Provider tokens never enter this module.

## `loadSetup`
Reads the public session result first and obtains the versioned setup snapshot only for an authenticated session.

## `isSignInView`
Narrows browser shell state to the entry components' three safe outcomes.

## `SetupSignalRail`
Displays current state and setup version only; it deliberately excludes account, token, provider, and calendar identifiers.

## `formatSetupState`
Converts status enum text to presentation copy without changing the stored server value.
