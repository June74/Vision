# `src/jobs/queue-consumer.ts`

The queue consumer claims a durable job, runs calendar synchronization once, and then acknowledges or retries safely.

## `consumeCalendarSyncBatch`

Processes one personal-calendar delivery at a time.

## `consumer`

Connects Cloudflare Queue delivery to production dependencies.

## `consumeOne`

Validates, claims, passes the internal opaque lease into synchronization, and records one message before ack or retry.

## `createProductionCalendarSyncConsumerDependencies`

Builds owner-bound database, encryption, token, and Google read dependencies.

## `now`

Reads fresh time for durable state transitions.

## `createClaimId`

Creates an opaque lease ID.

## `sync`

Runs the existing read-only transactional sync path with the active database claim.

## `classifyGoogleRefreshError`

Keeps revoked credentials, temporary failures, and provider failures as distinct safe outcomes.

## `verify`

Rejects ID-token verification on the refresh-only OAuth client.

## `deriveOwnerId`

Derives the same opaque owner ID used by authentication.

## `retryDelay`

Computes a bounded fallback Queue delay.
