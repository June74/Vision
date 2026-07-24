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

Maps status codes to authorization, expired-token, transient, or permanent provider categories.

## `validateSecretToken`

Accepts only one bounded non-empty bearer token at construction.
