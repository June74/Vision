# `src/domain/scheduling/proposal.ts`

Builds conflict-aware scheduling suggestions with citations and an explicit
approval-required calendar marker.

## `createSchedulingProposal`

Returns alternatives or a clarification/conflict result.

## `assertCalendarApprovalOperation`

Requires an existing approval operation before a write handoff.

## `formatPlanningLocalDateTime`

Formats one instant in an explicit IANA timezone.

## `valueFor`

Reads a formatted date/time component.

## `uniqueSourceFacts`

Rejects duplicate source IDs.

## `citationsForBlocks`

Builds cited source facts for busy blocks.

## `citationFor`

Creates one source citation.

## `candidateStarts`

Generates deterministic fifteen-minute candidates.

## `add`

Adds one bounded candidate.

## `toAlternative`

Creates a local-time alternative.

## `isBlocking`

Identifies confirmed or tentative busy blocks.

## `overlaps`

Checks half-open interval overlap.

## `parseInstant`

Parses an explicit timestamp.

## `validateTimeZone`

Checks an IANA timezone.

## `freezeProposal`

Freezes the returned proposal.
