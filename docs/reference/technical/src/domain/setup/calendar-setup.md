# `src/domain/setup/calendar-setup.ts`

## Dependencies, inputs, and role

This pure module accepts persisted `CalendarSetupState` data and a versioned `CalendarSetupCommand`; it has no OAuth, provider, event, HTTP, database, clock, or UI dependency. Each accepted mutation requires exact `setupVersion` equality and increments it once, enabling a persistence boundary to reject stale retries atomically. The transition into `creating` is authorization intent only; calendar creation is an adapter responsibility and this module provides no event-write operation.

## States and safe failures

The discriminated state union covers `signed_out`, `authenticated`, `discovering`, `awaiting_choice`, `awaiting_confirmation`, `creating`, `connected`, and `failed`. Existing owned candidates are explicitly selected by stable ID; creation can leave `awaiting_confirmation` only with the exact `CREATE VISION CALENDAR` literal. Errors are the constant safe codes `STALE_SETUP_VERSION`, `INVALID_SETUP_TRANSITION`, and `EXACT_CONFIRMATION_REQUIRED`, which do not echo a state, calendar ID, or provider response.

## `CalendarSetupTransitionError`

**Signature:** `(message) => Error`.

Constructs a safe transition failure restricted to the module's constant error codes.

## `transitionCalendarSetup`

**Signature:** `(state, command) => CalendarSetupState`.

Checks current-version concurrency before applying the allowed state-table edge. It returns new immutable state records and never performs an external side effect.

## `assertCurrentVersion`

**Signature:** `(state, command) => void`.

Rejects malformed, unsafe, or unequal setup versions before a transition can begin.

## `nextVersion`

**Signature:** `(state) => number`.

Returns exactly one greater than the current safe version and rejects the maximum safe integer overflow edge.

## `discoveredState`

**Signature:** `(command, setupVersion) => CalendarSetupState`.

Deduplicates nonblank stable IDs. No candidates enter exact creation confirmation; one or more candidates require explicit existing-calendar selection.

## `isSetupVersion`

**Signature:** `(value) => value is number`.

Runtime guard for safe non-negative integer versions.

## `isRecord`

**Signature:** `(value) => value is Record<string, unknown>`.

Rejects `null` and primitives before any state or command field is read.

## `isCalendarSetupStatus`

**Signature:** `(value) => value is CalendarSetupStatus`.

Restricts runtime status data to the complete eight-state union so unknown persisted/API values cannot fall through the switch.

## `isNonEmptyCalendarId`

**Signature:** `(value) => value is string`.

Runtime guard that excludes absent and whitespace-only opaque calendar IDs.

## `isCalendarIdArray`

**Signature:** `(value) => value is readonly string[]`.

Requires an array containing only nonblank opaque calendar IDs, for both discovery results and existing-candidate state.

## `isValidCalendarSetupState`

**Signature:** `(value) => value is CalendarSetupState`.

Validates the common version/status fields and state-specific candidate or connection fields before transition logic can access them.

## `isValidCalendarSetupCommand`

**Signature:** `(value) => value is CalendarSetupCommand`.

Enumerates only the nine command literals in `CalendarSetupCommand`, validates their common version/type fields and payload shapes, and rejects unknown or accessor-backed values before they reach transition logic.

## `getOwnDataProperty`

**Signature:** `(value, key) => { found, value }`.

Uses an own-property descriptor to accept only data properties and converts descriptor-trap failures to an absent property. This keeps hostile getters and proxies from leaking errors while validating untrusted command-shaped input.

## `snapshotSetupState`

Parses a descriptor-derived frozen record into one exact setup-state variant before transition code reads it.

## `snapshotSetupCommand`

Enumerates the nine command variants and parses one descriptor-derived frozen command snapshot before transition code reads it.

## `snapshotRecord`

Copies only enumerable own data properties from a standard object prototype, rejects symbols and unexpected fields, and catches reflection traps.

## `hasExactKeys`

Requires each state and command variant to have exactly its contract fields after snapshot extraction.

## `rejectInvalidTransition`

**Signature:** `() => never`.

Throws the constant invalid-transition code for an unavailable state-table edge.

## Test coverage

`tests/unit/domain/calendar-setup.test.ts` covers every named state, deterministic versions including the safe-integer maximum, stale commands, exact confirmation, existing-calendar selection, sign-out, unknown/accessor/proxy-backed commands, and malformed state/command inputs.
