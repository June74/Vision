# `src/client/planning/api.ts`

Reads template briefings, requests deterministic time suggestions, and manages
local follow-ups with same-origin credentials and CSRF-protected writes.

## `readPlanningBriefing`

Reads a template-backed briefing for one timezone and window.

## `createSchedulingProposal`

Requests conflict-aware alternatives without asking an AI provider.

## `readPlanningFollowUps`

Reads the authenticated owner's local follow-ups.

## `createPlanningFollowUp`

Creates a local follow-up.

## `transitionPlanningFollowUp`

Completes, reopens, or snoozes a local follow-up.

## `readPayload`

Rejects failed responses before parsing.

## `parseBriefingEnvelope`

Checks the template/no-AI/no-write briefing markers.

## `parseProposalEnvelope`

Checks the deterministic proposal and approval-only marker.

## `parseFollowUpsEnvelope`

Checks a follow-up list envelope.

## `parseFollowUpEnvelope`

Checks one follow-up response envelope.

## `parseFollowUp`

Checks follow-up lifecycle fields.

## `parseSection`

Checks a typed briefing section.

## `parseAlternative`

Checks one proposed time alternative.

## `parseConflict`

Checks one cited conflict.

## `parseCitation`

Checks one source citation.

## `isRecord`

Narrows unknown JSON to an object record.

## `isArray`

Narrows unknown JSON to an array.

## `readString`

Reads a required response string.

## `readNumber`

Reads a finite response number.

## `readEnum`

Reads a member of a closed response union.
