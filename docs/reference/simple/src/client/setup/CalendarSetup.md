# Calendar setup panel

Guides the approved Vision user through finding, choosing, or creating a separate calendar with no events.

## `CalendarSetup`
Shows the correct setup step from Vision's latest answer.

## `handleDiscovery`
Starts another owned-calendar check.

## `handleSelection`
Verifies the chosen calendar.

## `handleCreation`
Creates the separate calendar once with the exact phrase.

## `runCommand`
Prevents duplicate clicks while Vision handles one setup request.

## `DiscoveryState`
Explains the first calendar-search step.

## `ChoiceState`
Lets you choose an owned calendar to verify.

## `ConfirmationState`
Requires the exact creation phrase.

## `CreatingState`
Shows that Vision is confirming the creation.

## `ConnectedState`
Confirms a verified calendar connection.

## `ActionRequiredState`
Explains when Vision needs a manual review instead of guessing.

## `RetryState`
Offers a safe retry after a temporary setup problem.

## `readCreationKey`
Keeps one temporary replay key for the same setup version, never a token.
