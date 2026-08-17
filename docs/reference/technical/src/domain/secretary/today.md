# `src/domain/secretary/today.ts`

Pure deterministic projection over local records and explicitly supplied
read-only calendar event facts. It never returns a provider mutation method or
operation authority.

## `buildTodayProjection`

**Signature:** `(input) => SecretaryTodayProjection`

Validates the owner timezone, filters tasks by each task’s explicit timezone,
orders tasks/events by timestamp and ID, and adds `readOnly=true`,
`canWrite=false`, and `calendarWriteAuthority=approval-required`.

## `localDateKey`

**Signature:** `(value: Date, timeZone: string) => string`

Uses `Intl.DateTimeFormat(...).formatToParts` to avoid server-timezone or locale
string assumptions.

## `assertDate`

**Signature:** `(value: unknown) => asserts value is Date`

Rejects invalid dates.

## `assertTimeZone`

**Signature:** `(value: unknown) => asserts value is string`

Rejects invalid IANA zones rather than falling back to process timezone.
