# `src/domain/events/event.ts`

This module describes a calendar event without tying it to a particular calendar service. It keeps timing and busy information but not private event text.

## `VisionEventSchema`

`VisionEventSchema` requires complete provider identity, rejects unknown fields and backwards times, and checks valid category/state and privacy metadata.
