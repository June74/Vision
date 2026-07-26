# `src/client/status/api.ts`

## `readFoundationSnapshot`

Loads safe status and synchronized events together and rejects incomplete or malformed replies.

## `correctEventCategory`

Sends an authenticated Vision-only category correction with the current anti-forgery token.

## `parseStatus`

Keeps only the known health, sync, cost, and storage-warning shapes.

## `parseEvents`

Accepts at most 200 safe display events.

## `isFoundationEvent`

Checks one event's title, time, state, category, and provenance.

## `parseCorrection`

Checks that the server confirmed a user-set category.

## `isRecord`

Recognizes a JSON object before reading its properties.

## `isOneOf`

Checks text against a small approved list.

## `isNullableString`

Accepts text or an explicit empty marker.

## `isNullableNonnegativeNumber`

Accepts a positive measurement or an explicit empty marker.

## `isNonnegativeInteger`

Accepts safe whole-number counts and cents.
