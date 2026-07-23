# `src/domain/events/event.ts`

This module defines a strict planning-safe event contract linked to a canonical event node. `ProviderOrderKeySchema`
brands exactly 20 decimal digits, so PostgreSQL text comparison equals unsigned numeric order. Provider adapters must
derive this canonical key from provider revisions rather than passing opaque ETags.

## `VisionEventSchema`

The schema requires a complete strict provider identity, offset-aware start/end timestamps, timezone, busy status, event status, internal domain state, privacy level, and a positive version. Its refinement composes the shared domain/state constraint and rejects end timestamps at or before starts. Protected content is intentionally absent for the later encryption boundary. Covered by `tests/unit/domain/event.test.ts`.
