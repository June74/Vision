# `src/domain/secretary/today.ts`

Builds a timezone-aware local Today list and labels provider events as
read-only.

## `buildTodayProjection`

Filters open tasks and same-day events, orders them deterministically, and
returns `approval-required` calendar authority.

## `localDateKey`

Returns a YYYY-MM-DD key in a specified timezone.

## `assertDate`

Checks the projection date.

## `assertTimeZone`

Checks the IANA timezone.
