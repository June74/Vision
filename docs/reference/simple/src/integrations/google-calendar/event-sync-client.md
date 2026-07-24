# `src/integrations/google-calendar/event-sync-client.ts`

This read-only adapter calls Google `events.list`, validates each page, and maps every item into Vision's closed event
change contract. It exposes no Google event write operation.

## `listChanges`

Requests exactly one page with deleted events included. The caller supplies the same sync token again when requesting a
later page.

## `createGoogleEventSyncClient`

Builds the read-only adapter from a bounded access token and optional fetch implementation.

## `validateRequest`

Checks calendar, page, and sync identifiers without reflecting them in errors.

## `addCalendarIdentity`

Adds the trusted requested calendar ID before mapping an item.

## `classifyResponse`

Maps status codes and a small closed set of Google 403 reasons to safe authorization, quota, transient, or permanent categories.

## `readBoundedForbiddenReasons`

Reads at most 8 KiB from a 403 response and keeps only recognized reason fields.

## `readBoundedJson`

Parses a successful provider response only while it fits the strict page-size limit.

## `readBoundedBytes`

Stops reading and returns a safe payload-too-large error when a response crosses its byte cap.

## `classifyForbiddenReason`

Separates rate limits, account quota, revoked permissions, and unknown 403 failures.

## `validateSecretToken`

Accepts only one bounded non-empty bearer token at construction.
