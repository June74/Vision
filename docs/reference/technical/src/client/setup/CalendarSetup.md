# `src/client/setup/CalendarSetup.tsx`

Renders versioned setup states from server snapshots and serializes mutations through one in-flight ref.

## `CalendarSetup`
Owns visible setup state, exact-confirmation input, pending state, and one session-scoped idempotency UUID per setup version.

## `handleDiscovery`
Calls discovery with the latest server setup version.

## `handleSelection`
Calls selection with the latest version and user-selected calendar ID.

## `handleCreation`
Rejects non-exact confirmation and duplicate clicks before posting the stable key.

## `runCommand`
Serializes each async mutation and replaces local state only with a server response snapshot.

## `DiscoveryState`
Renders the initial discovery action.

## `ChoiceState`
Renders owned secondary calendar choices.

## `ConfirmationState`
Renders exact-phrase validation before create.

## `CreatingState`
Renders an in-progress status region.

## `ConnectedState`
Renders connection kind without provider identifiers.

## `ActionRequiredState`
Renders a non-retrying ambiguous result.

## `RetryState`
Renders an explicit discovery retry after a transient failure.

## `readCreationKey`
Uses `sessionStorage` only for an opaque UUID namespaced by setup version; it stores no provider response or token.

## `run`
Serializes one safe browser command.
## `discover`
Posts discovery with the current version.
## `restart`
Runs failure-atomic fresh discovery for terminal setup recovery.
## `select`
Posts an explicit calendar selection.
## `createOrReplay`
Posts the original operation version and key.
## `refresh`
Reads the authoritative setup snapshot.
## `renderControls`
Maps safe server states to controls.
## `announcement`
Creates concise live-region text.
## `readActiveCreation`
Validates the stored opaque replay record.
## `startActiveCreation`
Stores a UUID only after exact confirmation.
## `updateOperation`
Clears or updates replay context from server state.
