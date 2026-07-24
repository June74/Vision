# `src/jobs/queue-consumer.ts`

The consumer treats Cloudflare delivery as at-least-once. PostgreSQL claim state is authoritative, while `syncCalendar` remains responsible for paginated provider reads and atomic checkpoint advancement.

## `consumeCalendarSyncBatch`

Serial execution complements `max_concurrency: 1` and avoids racing one private calendar inside a batch.

## `consumer`

Creates production dependencies once per batch and delegates to the testable narrow consumer.

## `consumeOne`

Strictly parses the opaque body, acquires a durable claim, and calls `syncCalendar` with the repository attempt. Typed retryable errors are persisted before `retry`; permanent errors are persisted before `ack`. Unknown errors become `Action required` on attempt six.

## `createProductionCalendarSyncConsumerDependencies`

Validates Worker configuration, opens the least-privileged database, restores wrapped keys, decrypts only owner-bound tokens, refreshes a missing or near-expiry access token while preserving the durable refresh token, constructs the read-only Google client, and reuses the atomic sync repository. A rejected grant becomes disconnected; transient refresh or persistence failure is retried without logging token material.

## `now`

Avoids reusing a stale batch timestamp across security and persistence decisions.

## `createClaimId`

Creates an unguessable lease so stale deliveries cannot finish another worker's claim.

## `sync`

Checks owner scope, resolves the retained access token inside the trusted process, and invokes `syncCalendar`; queue messages never contain credentials.

## `verify`

The OAuth instance used here is refresh-only. Its injected ID-token verifier always fails so this background path cannot accidentally become an identity-verification boundary.

## `deriveOwnerId`

SHA-256 hashes the allowlisted Google subject into the authentication-compatible `usr_` identifier.

## `retryDelay`

Provides exponential fallback delay capped at ten minutes without an in-request retry loop.
