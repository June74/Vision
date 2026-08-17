# `src/domain/briefings/briefing.ts`

`buildBriefing` is a pure template boundary. It consumes authorized planning
facts and never calls an AI provider or calendar adapter.

## `buildBriefing`

**Signature:** `(input) => Briefing`

Filters calendar intervals by overlap and open task/follow-up due instants by
half-open membership, orders each section deterministically, and deduplicates
source citations. Automation is `template/false`; calendar write authority is
`approval-required/false`.

## `addCitation`

Adds a citation only when the source identifier exists in the trusted map.

## `parseInstant`

Rejects invalid timestamps without process-local conversion.

## `within`

Uses `start <= value < end` semantics.

## `overlaps`

Uses half-open interval semantics for calendar blocks.
