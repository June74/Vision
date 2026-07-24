# Google event mapper

Converts one Google event and its supplied calendar ID into a safe Vision sync change. It reads Google data but never calls Google or writes calendar events.

## `GoogleEventMappingError`

Reports invalid provider event data without showing it.

## `GoogleCalendarMappingContext`

Carries the trusted collection timezone for date-only Google values.

## `mapGoogleEvent`

Maps normal events to upserts and sparse cancelled events to stable tombstones, with optional trusted collection context.

## `validateNamedTimeZone`

Checks a supplied IANA timezone.

## `toProviderOrderKey`

Turns a strict offset-bearing update time into an upsert-only fixed-width order key.

## `mapRecurrence`

Keeps only master and occurrence identity.

## `normalizeGoogleTime`

Turns Google date and date-time values into UTC instants.

## `resolveGoogleTimeZone`

Requires a named event or collection timezone for date-only values and derives timed offset zones explicitly.

## `normalizeGoogleDateTime`

Uses an explicit offset only when it agrees with the supplied IANA timezone, or the required supplied IANA timezone for a local wall-clock value.

## `parseGoogleDateTime`

Reads safe RFC 3339 calendar parts before conversion.

## `localDateStartToInstant`

Finds the earliest instant belonging to an all-day local date, unless the whole date was skipped.

## `toLocalDateKey`

Builds a comparable local-date key.

## `formatLocalDateKey`

Formats an instant's calendar date in an IANA timezone.

## `localDateTimeToInstant`

Converts an offset-less local date-time only when it names one instant.

## `getCandidateOffsets`

Finds nearby timezone offsets around daylight-saving changes.

## `matchesLocalDateTime`

Checks an instant against local calendar fields in an IANA timezone.

## `getTimeZoneOffset`

Looks up an IANA timezone offset at one instant.

## `mapAttendees`

Keeps attendee email addresses in protected content.

## `mapMeetingLinks`

Keeps call links in protected content.

## `mapAttachmentReferences`

Keeps attachment locators but not their contents or titles.
