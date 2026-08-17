# `src/domain/scheduling/proposal.ts`

This pure contract turns owner-authorized planning facts into a deterministic
preview. It does not call AI, Google Calendar, or the write executor.

## `createSchedulingProposal`

Validates bounded request/window/source shapes, rejects invalid zones and
durations, treats confirmed/tentative busy intervals as hard conflicts, scans
fifteen-minute alternatives, converts display times through the requested IANA
zone, and returns citations. Ambiguity returns no guessed alternatives. The
result always carries `automation.aiEnabled=false` and
`calendarWrite.canConfirm=false`.

## `assertCalendarApprovalOperation`

Rejects non-ready proposals, missing/invalid operation identities, and every
attempt lacking a pre-existing shared calendar approval operation. This is a
handoff guard, not a provider write.

## `formatPlanningLocalDateTime`

Formats UTC instants as `YYYY-MM-DD HH:mm` using only the explicit IANA zone.

## `valueFor`

Reads a required `Intl.DateTimeFormat` part.

## `uniqueSourceFacts`

Rejects duplicate fact IDs before citations.

## `citationsForBlocks`

Deduplicates trusted block source facts in source order.

## `citationFor`

Maps one trusted fact to the public citation shape.

## `candidateStarts`

Places the preferred instant first, then fifteen-minute starts that fit.

## `add`

Bounds and de-duplicates one candidate start.

## `toAlternative`

Creates normalized UTC and local display values.

## `isBlocking`

Excludes cancelled or non-busy rows from conflicts.

## `overlaps`

Uses half-open interval semantics.

## `parseInstant`

Parses finite explicit-offset timestamps.

## `validateTimeZone`

Uses the runtime formatter to reject invalid IANA zones.

## `freezeProposal`

Freezes the top-level proposal envelope before returning it.
