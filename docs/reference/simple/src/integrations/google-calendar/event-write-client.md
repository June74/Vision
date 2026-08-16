# `src/integrations/google-calendar/event-write-client.ts`

This is the narrow Google Calendar adapter used by the Phase C create
executor. It talks only to the fixed Google Calendar API origin, sends no
attendees or notifications, marks each event with an opaque operation ID, and
turns uncertain provider state into a safe pending outcome.

## `createGoogleEventWriteClient`

Builds the adapter from a bounded access token and optional test fetcher. The
returned methods are the only Google event-write operations exposed here.

## `readCalendarVersion`

Reads the selected calendar's current version before a confirmed write.

## `createOneOffEvent`

Creates exactly one timed event with `sendUpdates=none`, no attendees or
recurrence, and private operation, domain, and privacy markers.

## `findByOperationId`

Searches for events carrying the private operation marker after an uncertain
create. It does not create another event.

## `readEvent`

Reads and normalizes one event. A confirmed provider not-found response becomes
absence; malformed or unexpected data stays uncertain.

## `deleteEvent`

Deletes one event with its expected version and no notifications. A provider
not-found response is safe evidence that the event is already absent.

## `buildEventsUrl`

Builds a fixed-origin, encoded Google events URL.

## `validateCreateInput`

Checks the closed one-off event shape before any provider request.

## `normalizeEvent`

Converts a validated Google response into the provider-neutral event shape.

## `requestJson`

Applies the bearer token, deadline, response-size limit, media-type check, and
constant definite-versus-uncertain error classification.

## `readBoundedJson`

Reads JSON through a byte and chunk limit before parsing it.

## `isUncertainStatus`

Recognizes statuses whose mutation outcome may be unknown.

## `assertOpaqueId`

Rejects malformed operation and event identifiers without reflecting them.

## `assertProviderText`

Rejects unsafe calendar identifiers and provider versions before URL or header
use.

## `isProviderText`

Checks bounded provider text without allowing control characters.

## `isBoundedText`

Checks a nonempty bounded string used by the adapter.

## `readPositiveBound`

Keeps configured deadlines and body limits within reviewed ceilings.
