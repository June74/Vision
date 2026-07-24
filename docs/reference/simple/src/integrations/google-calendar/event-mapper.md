# Google event mapper

Converts one Google event and its supplied calendar ID into a safe Vision sync change. It reads Google data but never calls Google or writes calendar events.

## `GoogleEventMappingError`

Reports invalid provider event data without showing it.

## `mapGoogleEvent`

Maps normal events to upserts and cancelled events to deletions.

## `readTimeZone`

Finds the source timezone for the event.

## `toProviderOrderKey`

Turns the provider update time into a fixed-width order key.

## `mapRecurrence`

Keeps only master and occurrence identity.

## `normalizeGoogleTime`

Turns Google date and date-time values into UTC instants.

## `localDateStartToInstant`

Converts an all-day local date without using the server timezone.

## `getTimeZoneOffset`

Looks up an IANA timezone offset at one instant.

## `mapAttendees`

Keeps attendee email addresses in protected content.

## `mapMeetingLinks`

Keeps call links in protected content.

## `mapAttachmentReferences`

Keeps attachment locators but not their contents or titles.
