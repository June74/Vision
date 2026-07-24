# `src/client/setup/api.ts`

Defines typed browser adapters for public session/setup JSON. Only the CSRF value is retained in React state; no OAuth or provider token enters local or session storage.

## `readSession`
Maps `GET /api/auth/session` to an authenticated session or safe shell outcome.

## `readCalendarSetup`
Reads `GET /api/setup/calendar` as the server-authoritative setup snapshot.

## `discoverCalendars`
Posts the current setup version and CSRF header to calendar discovery.

## `selectCalendar`
Posts an explicit calendar ID and current setup version to verification.

## `confirmCalendarCreation`
Posts exact confirmation, the server version, and a caller-owned idempotency UUID.

## `sendSetupCommand`
Issues one same-origin JSON POST with the session CSRF header.

## `readSetupResponse`
Accepts setup snapshots from success, conflict, and in-progress HTTP responses; it discards non-snapshot errors.
