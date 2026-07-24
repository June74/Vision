# `src/domain/sync/change.ts`

Defines strict Zod contracts for the provider-neutral event changes consumed by later synchronization jobs. The module imports only the canonical provider identity contract and does not couple domain data to Google, storage, queues, or cryptography.

## `ProviderAttachmentReferenceSchema`

Requires an opaque attachment ID or URL with optional MIME type. It intentionally omits Google attachment title and contents, so attachment bytes and user-facing attachment text never cross the mapper boundary.

## `ProviderEventProtectedPayloadSchema`

Separates title, description, location, attendee addresses, meeting links, and attachment locators from planning-safe event facts. A repository must encrypt this entire payload before persistence.

## `ProviderRecurrenceSchema`

Uses a closed discriminated union for single events, masters, and occurrences. Occurrences preserve their master identity and optional original-start instant without retaining Google recurrence-rule text.

## `UpsertEventSchema`

Requires queryable provider identity, normalized offset-aware instants, source zone, busy state, and status. The refinement rejects zero or negative durations. It deliberately has no Vision category, domain, or privacy field because deterministic Vision policy resolves those separately.

## `DeleteEventSchema`

Represents a provider tombstone using only provider identity and recurrence identity. The strict schema refuses protected payload fields, preventing stale event text from surviving a deletion mapping.

## `ProviderEventChangeSchema`

Provides the closed upsert-or-delete boundary for providers. Later synchronization code validates staged changes through this schema before any database mutation.
