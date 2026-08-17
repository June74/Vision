# `src/client/planning/PlanningDesk.tsx`

The React surface keeps planning state separate from the shared calendar-write
pipeline. It loads briefings and follow-ups independently and treats every
suggestion as a non-authoritative preview.

## `PlanningDesk`

Owns browser state for briefing, proposal, and follow-up values. It renders
only local transitions and an approval-required calendar message.

## `submitProposal`

Creates an eight-hour bounded local planning request. The server supplies
trusted busy facts and source citations.

## `submitFollowUp`

Creates a local follow-up with no provider event request.

## `changeFollowUp`

Submits a complete/reopen transition and replaces only the returned owner row.

## `ProposalCard`

Shows local alternatives/conflicts and states that no calendar change was
confirmed.
