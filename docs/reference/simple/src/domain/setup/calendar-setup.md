# `src/domain/setup/calendar-setup.ts`

This file guides safe calendar setup in small numbered steps. A command must use the current setup number, and the phrase `CREATE VISION CALENDAR` must match exactly before creating can start.

## `CalendarSetupTransitionError`

Represents a safe setup error without calendar or provider details.

## `transitionCalendarSetup`

Moves the setup journey forward only when the command is valid for the current state and version.

## `assertCurrentVersion`

Rejects a repeated or out-of-date command.

## `nextVersion`

Increases the setup number by one after an accepted command.

## `discoveredState`

Turns a list of existing calendar IDs into a choice state or a creation-confirmation state.

## `isSetupVersion`

Checks that a setup number is a safe non-negative whole number.

## `isRecord`

Checks that input is a present object before reading fields from it.

## `isCalendarSetupStatus`

Checks that state text is one of Vision's eight setup stages.

## `isNonEmptyCalendarId`

Checks that a calendar ID is present.

## `isCalendarIdArray`

Checks that a calendar list contains only present IDs.

## `isValidCalendarSetupState`

Checks that a saved setup state has the fields needed for its current stage.

## `isValidCalendarSetupCommand`

Checks that a setup command has safe fields before the state machine uses it.

## `getOwnDataProperty`

Reads a command field only when it is ordinary stored data, not a getter or hostile proxy that can run code.

## `rejectInvalidTransition`

Stops a command that does not make sense in the current state.
