# `src/domain/events/event.ts`

This module describes a calendar event without tying it to a particular calendar service. It keeps timing and busy information but not private event text.

## `VisionEventSchema`

`VisionEventSchema` checks the event identity, time range, status, category, privacy, and version.
