# `src/client/calendar/EventList.tsx`

## `EventList`

**Signature:** `EventList({ events, onCategoryChange }): JSX.Element`

Renders the server-bounded collection as a semantic list. Each event has an ordinal, machine-readable time, authorized title fallback, timezone, provider status, and `CategoryControl`. No connected-calendar mutation control is rendered.

## `formatDate`

Uses `Intl.DateTimeFormat` with the event-recorded IANA timezone rather than the device's timezone.

## `formatTime`

Uses a timezone-pinned `Intl.DateTimeFormat` so start and end remain consistent with the synchronized record.

## `formatEventStatus`

Capitalizes the finite provider status for display without modifying source data.
