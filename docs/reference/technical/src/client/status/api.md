# `src/client/status/api.ts`

## `readFoundationSnapshot`

**Signature:** `readFoundationSnapshot(): Promise<FoundationSnapshot>`

Starts status and event fetches together with same-origin credentials and waits for both outcomes. It rejects non-2xx, network, malformed JSON, unknown enum, and oversized event responses rather than rendering untrusted shapes.

## `correctEventCategory`

**Signature:** `correctEventCategory(session, eventId, domain): Promise<CategoryCorrection>`

URL-encodes the opaque event ID and sends a strict JSON `PATCH` with the session CSRF header. It parses only a confirmed user-provenance result.

## `parseStatus`

Validates every required status field, exact health/budget/authorization enums, nullable timestamps and ages, nonnegative counts/cents, booleans, and string warning codes.

## `parseEvents`

Enforces the server's 200-event browser bound and delegates every element to `isFoundationEvent`.

## `isFoundationEvent`

Validates only the display allowlist: opaque ID, nullable title, schedule/timezone, provider status, domain state, and category provenance.

## `parseCorrection`

Requires a concrete domain, confirmed state, user provenance, timestamp, and whole-number version.

## `isRecord`

Rejects null and arrays before property inspection.

## `isOneOf`

Provides a generic type guard for immutable string allowlists.

## `isNullableString`

Accepts string or null for explicitly absent API facts.

## `isNullableNonnegativeNumber`

Rejects negative and non-finite measurements while allowing null.

## `isNonnegativeInteger`

Rejects fractional, unsafe, and negative counts or cent values.
