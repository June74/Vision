# Google event mapper

This pure adapter accepts an unknown Google Calendar event response plus a trusted caller-supplied `calendarId`, permits unknown future provider fields only while parsing the raw boundary, and emits a strict `ProviderEventChange`. It has no network method and exposes no event write capability. Mapper failures use one constant message so raw provider text is not retained in error logs.

## `GoogleEventMappingError`

Provides the sole safe failure for malformed, oversized, impossible, or timezone-invalid provider event data. Its message excludes event values, tokens, URLs, and provider response bodies.

## `GoogleCalendarMappingContext`

Carries the trusted `timeZone` returned at the Google `events.list` collection boundary. It is optional only to preserve direct mapping of fully timed values; callers must supply it whenever a date-only start, end, or recurring original-start field lacks its own IANA timezone.

## `mapGoogleEvent`

Validates the permissive raw Google payload and defaults absent ordinary `status` to Google’s `confirmed` default. An upsert requires `updated` and receives a versioned identity; a cancelled resource maps before version parsing to an explicit stable target tombstone because Google guarantees only sparse deletion fields. Later synchronization must commit such tombstones under its trusted page/checkpoint transaction ordering. The optional context supplies the collection timezone for date-only values; absent context is rejected instead of silently assuming UTC. The mapper ignores Google extended properties, including any provider-side Vision category-like values. Title, description, location, attendee email addresses, meeting links, and attachment references are emitted only in `protected`.

## `validateNamedTimeZone`

Validates an event-level or trusted collection IANA timezone through `Intl`. Invalid zones fail before mapping; there is no implicit UTC default.

## `toProviderOrderKey`

First requires Google `updated` to be a strict RFC 3339 date-time with `Z` or a numeric `+/-HH:MM` offset, then converts it to a zero-padded 20-digit millisecond timestamp. Offset-less and RFC-822-like strings are rejected before `Date.parse`, preventing Worker-host timezone dependence in the canonical provider-order key.

## `mapRecurrence`

Creates a closed single/master/occurrence recurrence value. It intentionally discards recurrence rules while retaining master ID and, when supplied, the original occurrence start instant needed for stable reconciliation.

## `normalizeGoogleTime`

Resolves each Google time object independently, then normalizes a RFC 3339 `dateTime` to ISO UTC or delegates an all-day `date` to calendar-zone conversion. A date-only field requires its own IANA timezone or the trusted collection context. When `dateTime` has no offset, Google permits the field only with an explicit `timeZone`; the mapper resolves that wall-clock value in this IANA zone rather than using the Worker host timezone. Missing, malformed, timed gap, and timed overlap values fail before an upsert is emitted. Fractional milliseconds are preserved without contaminating sampled timezone offsets.

## `resolveGoogleTimeZone`

Uses an event time object's named IANA zone first. For a date-only value with no own zone it requires and validates `calendarTimeZone`; for a timed value with an explicit RFC 3339 offset but no named zone it derives `UTC` or a fixed `UTC+/-HH:MM` representation from the offset, never from the Worker host. Offset-less timed values still require their own named timezone under Google’s contract.

## `normalizeGoogleDateTime`

Uses `Date.parse` only after an explicit RFC 3339 offset or `Z` is present. If the same Google time object supplies an IANA `timeZone`, the resulting instant must round-trip to every original local component, including milliseconds, in that zone; contradictory offset/zone facts are rejected. Offset-less values require their own `timeZone` field and are then passed to deterministic IANA-zone conversion, so a preview or production Worker timezone cannot shift events.

## `parseGoogleDateTime`

Parses and validates date, clock, fractional-millisecond, and optional strict RFC 3339 offset fields. Calendar overflow is rejected rather than normalized by the JavaScript date parser.

## `localDateStartToInstant`

Finds the earliest instant whose IANA calendar date equals the requested all-day date through a bounded 96-hour binary search. A midnight gap starts the date later and a midnight overlap selects the first occurrence; only a wholly skipped date, such as `Pacific/Apia` on 2011-12-30, is rejected.

## `toLocalDateKey`

Builds a fixed-width `YYYYMMDD` comparison key from validated date fields for date-boundary searching.

## `formatLocalDateKey`

Formats an instant as an IANA-zone date key without consulting the Worker host timezone. It is monotonic across instants, allowing the bounded lower-bound search to locate the earliest instant of an existing local date.

## `localDateTimeToInstant`

Finds candidate instants for an offset-less local clock value by combining the local epoch with nearby timezone offsets and formatting each candidate back in the requested IANA zone. Exactly one match is required: daylight-saving gaps have zero and overlaps have two candidates, so both are rejected as ambiguous provider input rather than guessed.

## `getCandidateOffsets`

Samples a bounded 72-hour neighborhood around the local epoch. This includes the offsets on either side of ordinary daylight-saving transitions without unbounded timezone searching.

## `matchesLocalDateTime`

Formats a candidate instant through numeric `Intl` parts and compares every date, clock, and millisecond component with the parsed wall clock. It never reads the Worker host timezone.

## `getTimeZoneOffset`

Uses numeric `Intl.DateTimeFormat` parts to calculate an IANA offset from a whole-second sample. The fractional part is deliberately removed before sampling so offset-less provider milliseconds are not folded into the offset; candidate instants restore the original milliseconds afterward.

## `mapAttendees`

Copies only non-empty attendee email addresses and deduplicates them in provider order. Display names and response metadata are neither queryable nor copied into the change.

## `mapMeetingLinks`

Collects legacy Hangout and conference entry-point URIs, deduplicates them, and keeps them in the encrypted payload rather than planning data.

## `mapAttachmentReferences`

Copies only an attachment ID, URL, and MIME type when at least an ID or URL exists. Google attachment titles and all attachment bytes are intentionally excluded.
