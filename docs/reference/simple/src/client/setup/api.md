# Calendar setup connection

These helpers ask Vision about the current session and calendar setup. They never keep Google tokens.

## `readSession`
Checks whether you are signed in, denied, signed out, or temporarily unable to continue.

## `readCalendarSetup`
Reads the latest calendar-setup step from Vision.

## `discoverCalendars`
Looks for calendars you own.

## `selectCalendar`
Asks Vision to verify the calendar you chose.

## `confirmCalendarCreation`
Asks Vision to create the separate calendar only after the exact confirmation phrase.

## `sendSetupCommand`
Sends a protected setup request to Vision.

## `readSetupResponse`
Reads a safe setup result and rejects incomplete responses.
