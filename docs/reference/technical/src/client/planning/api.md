# `src/client/planning/api.ts`

The browser adapter is intentionally narrower than the Worker contract. It
adds same-origin credentials, sends the session CSRF token for every mutation,
and rejects response graphs that lose deterministic automation or approval-only
calendar markers.

## `readPlanningBriefing`

**Signature:** `(timeZone, window?) => Promise<Briefing>`

Accepts only a template-backed `aiEnabled=false` briefing envelope.

## `createSchedulingProposal`

**Signature:** `(session, input) => Promise<SchedulingProposal>`

Sends only the desired window and ambiguity. Trusted busy facts are loaded by
the server; the browser cannot supply or confirm a calendar operation.

## `readPlanningFollowUps`

**Signature:** `(timeZone) => Promise<readonly FollowUp[]>`

Reads owner-scoped local follow-ups.

## `createPlanningFollowUp`

**Signature:** `(session, input) => Promise<FollowUp>`

Sends a CSRF-protected local creation request.

## `transitionPlanningFollowUp`

**Signature:** `(session, id, action, snoozedUntil?) => Promise<FollowUp>`

Sends one explicit local lifecycle action with no provider capability.

## `readPayload`

Rejects non-2xx responses and delegates unknown JSON to an allowlist parser.

## `parseBriefingEnvelope`

Requires template automation, AI disabled, and `canConfirm=false`.

## `parseProposalEnvelope`

Requires deterministic automation and the approval-only calendar marker.

## `parseFollowUpsEnvelope`

Parses the owner follow-up list wrapper.

## `parseFollowUpEnvelope`

Parses one created or transitioned follow-up wrapper.

## `parseFollowUp`

Validates the open/snoozed/completed union.

## `parseSection`

Validates typed briefing sections.

## `parseAlternative`

Validates exact UTC and local time strings.

## `parseConflict`

Validates one hard conflict and its citation.

## `parseCitation`

Validates a source fact citation.

## `isRecord`

Excludes arrays from response property-bag parsing.

## `isArray`

Provides the explicit array guard.

## `readString`

Rejects non-string response fields.

## `readNumber`

Rejects non-finite response numbers.

## `readEnum`

Restricts response values to the declared union.
