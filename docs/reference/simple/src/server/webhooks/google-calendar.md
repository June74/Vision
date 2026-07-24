# `src/server/webhooks/google-calendar.ts`

The Google Calendar webhook verifies a registered channel and creates an opaque synchronization job. Notifications are change signals, not event data.

## `registerGoogleCalendarWebhook`

Registers `POST /webhooks/google/calendar` and returns `204` for accepted or safely discarded signals, including authenticated `not_exists` lifecycle notices.

## `createProductionGoogleCalendarWebhookDependencies`

Connects the route to PostgreSQL and Cloudflare Queue.

## `now`

Reads current time for expiry validation.

## `parseGoogleNotificationHeaders`

Reads and bounds the required Google notification headers.

## `isBoundedMessageNumber`

Validates Google's decimal message counter without precision loss.

## `sha256Base64Url`

Hashes a channel token before database lookup.

## `stableNotificationJobId`

Creates the same opaque job ID for the same notification.

## `constantTimeEqual`

Compares fixed-size token digests without early exit.

## `encodeBase64Url`

Encodes digest bytes as canonical unpadded base64url.

## `boundedText`

Checks non-empty header length.
