# `src/domain/sync/change.ts`

Defines the small set of provider event changes that synchronization may stage. Existing events carry planning data and protected content separately; deletions carry only identity and recurrence information.

## `ProviderAttachmentReferenceSchema`

Accepts an attachment ID or URL but never attachment bytes or display text.

## `ProviderEventProtectedPayloadSchema`

Defines content that must be encrypted before it reaches storage.

## `ProviderRecurrenceSchema`

Records whether an event is standalone, a recurring master, or an occurrence.

## `UpsertEventSchema`

Checks a current event projection, including valid ordering of its start and end.

## `DeleteEventSchema`

Checks a tombstone with no protected content.

## `ProviderEventChangeSchema`

Accepts exactly one upsert or deletion shape.
