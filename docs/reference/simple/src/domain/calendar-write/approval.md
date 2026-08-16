# `src/domain/calendar-write/approval.ts`

This module describes a calendar change before Vision is allowed to send it to
Google. It makes the proposed change and its visible effects explicit, and it
does not call Google or write anything by itself.

## `createCalendarWriteProposal`

Checks a one-off event proposal, rejects unsupported attendees, recurrence, and
notifications, and returns a frozen before/after preview.

## `transitionCalendarWrite`

Moves a proposal through proposed, confirmed, writing, and verified or pending
outcomes. A changed calendar version invalidates approval.

## `CalendarWriteContractError`

Provides one safe reason code without reflecting rejected event content.

## `readPlainRecord`

Checks an object shape without running getters or accepting hidden fields.

## `readPlainAttendees`

Checks the attendee list shape before the contract decides whether attendees
are supported.

## `readProposalInput`

Prepares the nested proposal data for the strict contract checks.

## `invalidProposal`

Creates the constant invalid-input result.

## `invalidTransition`

Creates the constant illegal-state result.

## `freezeValue`

Makes the returned proposal and its preview immutable.
