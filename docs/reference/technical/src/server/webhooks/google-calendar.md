# `src/server/webhooks/google-calendar.ts`

Google notifications are not cryptographically signed. Authenticity comes from a random stored channel token plus exact channel ID, resource ID, and non-expired lifecycle state. The request body is ignored and no event fetch occurs in the HTTP request.

## `registerGoogleCalendarWebhook`

Parses the closed header set, hashes the supplied token, resolves a connected channel by ID plus digest, repeats a constant-time digest comparison, and checks resource identity and expiry. Authenticated `not_exists` lifecycle notices are acknowledged without a sync job. Other accepted states reserve PostgreSQL work before Queue send, then mark the send. Sequential duplicate HTTP signals do not enqueue twice; uncertain sends remain recoverable by replay.

## `createProductionGoogleCalendarWebhookDependencies`

Requires the Queue binding and constructs the least-privileged database repository lazily only when the webhook route runs.

## `now`

Provides a fresh time for channel expiry.

## `parseGoogleNotificationHeaders`

Accepts `sync`, `exists`, and `not_exists`, and bounds IDs, token, resource, and message number. It never reads the request body.

## `isBoundedMessageNumber`

Uses `BigInt` for the unsigned 64-bit counter so JavaScript number rounding cannot collapse deduplication keys.

## `sha256Base64Url`

Computes a fixed-size SHA-256 digest; plaintext channel tokens are neither queried nor persisted by this path.

## `stableNotificationJobId`

Hashes a versioned tuple of channel, resource, and message number, producing one deterministic opaque ID.

## `constantTimeEqual`

XORs every byte of both fixed-size digests and includes their length difference.

## `encodeBase64Url`

Produces the canonical 43-character SHA-256 encoding used by the schema constraint.

## `boundedText`

Applies strict non-empty length limits before hashing or SQL.
