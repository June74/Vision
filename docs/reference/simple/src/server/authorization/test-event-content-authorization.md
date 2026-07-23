# `src/server/authorization/test-event-content-authorization.ts`

Vitest-only support for exercising authorized and denied repository behavior. It throws outside Vitest and production
source/bundle scans prevent it from reaching the Worker.

## `createTestEventRepositoryAccess`

Creates a fixed-owner test access capability.

## `authorize`

Issues a test decision only for that owner and the configured test privacy rule.
