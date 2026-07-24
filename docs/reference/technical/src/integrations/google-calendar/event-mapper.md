# Google event mapper

This pure adapter accepts an unknown Google Calendar event response plus a trusted caller-supplied `calendarId`, permits unknown future provider fields only while parsing the raw boundary, and emits a strict `ProviderEventChange`. It has no network method and exposes no event write capability. Mapper failures use one constant message so raw provider text is not retained in error logs.

## `GoogleEventMappingError`

Provides the sole safe failure for malformed, oversized, impossible, or timezone-invalid provider event data. Its message excludes event values, tokens, URLs, and provider response bodies.

## `mapGoogleEvent`

Validates the permissive raw Google payload, constructs a fixed provider identity from the calendar context, event ID, and update instant, then returns an upsert or explicit delete tombstone. It ignores Google extended properties, including any provider-side Vision category-like values. Title, description, location, attendee email addresses, meeting links, and attachment references are emitted only in `protected`.

## `readTimeZone`

Selects start, end, event, or UTC timezone in that order and validates it through `Intl`. The selected source zone remains queryable beside normalized UTC instants.

## `toProviderOrderKey`

First requires Google `updated` to be a strict RFC 3339 date-time with `Z` or a numeric `+/-HH:MM` offset, then converts it to a zero-padded 20-digit millisecond timestamp. Offset-less and RFC-822-like strings are rejected before `Date.parse`, preventing Worker-host timezone dependence in the canonical provider-order key.

## `mapRecurrence`

Creates a closed single/master/occurrence recurrence value. It intentionally discards recurrence rules while retaining master ID and, when supplied, the original occurrence start instant needed for stable reconciliation.

## `normalizeGoogleTime`

Normalizes a Google RFC 3339 `dateTime` to ISO UTC or delegates an all-day `date` to calendar-zone conversion. When `dateTime` has no offset, Google permits the field only with an explicit `timeZone`; the mapper resolves that wall-clock value in this IANA zone rather than using the Worker host timezone. Missing, malformed, gap, and overlap values fail before an upsert is emitted.

## `normalizeGoogleDateTime`

Uses `Date.parse` only after an explicit RFC 3339 offset or `Z` is present. If the same Google time object supplies an IANA `timeZone`, the resulting instant must round-trip to every original local component, including milliseconds, in that zone; contradictory offset/zone facts are rejected. Offset-less values require their own `timeZone` field and are then passed to deterministic IANA-zone conversion, so a preview or production Worker timezone cannot shift events.

## `parseGoogleDateTime`

Parses and validates date, clock, fractional-millisecond, and optional strict RFC 3339 offset fields. Calendar overflow is rejected rather than normalized by the JavaScript date parser.

## `localDateStartToInstant`

Converts a calendar-local all-day boundary through the same candidate-and-round-trip logic as offset-less date-times. A skipped local date, such as `Pacific/Apia` on 2011-12-30, has no matching instant and is rejected rather than silently shifted to a different calendar date.

## `localDateTimeToInstant`

Finds candidate instants for an offset-less local clock value by combining the local epoch with nearby timezone offsets and formatting each candidate back in the requested IANA zone. Exactly one match is required: daylight-saving gaps have zero and overlaps have two candidates, so both are rejected as ambiguous provider input rather than guessed.

## `getCandidateOffsets`

Samples a bounded 72-hour neighborhood around the local epoch. This includes the offsets on either side of ordinary daylight-saving transitions without unbounded timezone searching.

## `matchesLocalDateTime`

Formats a candidate instant through numeric `Intl` parts and compares every date, clock, and millisecond component with the parsed wall clock. It never reads the Worker host timezone.

## `getTimeZoneOffset`

Uses numeric `Intl.DateTimeFormat` parts to calculate an IANA offset at one instant. A second offset evaluation handles a daylight-saving transition around the target local midnight.

## `mapAttendees`

Copies only non-empty attendee email addresses and deduplicates them in provider order. Display names and response metadata are neither queryable nor copied into the change.

## `mapMeetingLinks`

Collects legacy Hangout and conference entry-point URIs, deduplicates them, and keeps them in the encrypted payload rather than planning data.

## `mapAttachmentReferences`

Copies only an attachment ID, URL, and MIME type when at least an ID or URL exists. Google attachment titles and all attachment bytes are intentionally excluded.
