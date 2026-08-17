# `src/domain/briefings/briefing.ts`

Builds a stable briefing from facts that fall inside an explicit window.

## `buildBriefing`

Creates calendar, task, and follow-up sections with source citations and no
calendar confirmation authority.

## `addCitation`

Adds a known source fact once.

## `parseInstant`

Reads a valid timestamp.

## `within`

Checks a due instant against the window.

## `overlaps`

Checks an event interval against the window.
