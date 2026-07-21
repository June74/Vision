# AI Secretary — Living Project Plan

This file is the project's editable source of truth. It records the agreed direction, current phase, open decisions, and completion gates. Update it whenever a decision changes or a phase is completed.

**Status:** Phase A — Plan the product

**Last updated:** 2026-07-21

**Current deliverable:** Product contract for the first usable version

## Product vision

Create one AI secretary that helps manage school, work, and personal life while preserving separate privacy boundaries for each domain.

The secretary should turn commitments into an understandable, reversible loop:

> Capture → understand → recommend → approve or act → monitor → alert → follow up → learn

## Agreed product principles

- Serve school, work, and personal life through one shared planning engine.
- Keep the source, domain, and privacy level attached to every event, task, note, and recommendation.
- Share planning facts across domains by default while keeping detailed content separated unless the user explicitly links it.
- Treat permissions and hard calendar constraints as absolute; recommendation scores cannot override them.
- Start with approval-based actions and introduce narrow, reversible autonomy later.
- Explain why each recommendation was made and what trade-off it creates.
- Keep an audit history and an undo path for every calendar-changing action.
- Use AI for interpretation, extraction, summarization, and explanations—not as the final authority for permissions or calendar writes.

## Development pipeline

```mermaid
flowchart TD
    A["A. Plan the product<br/>Features • priorities • privacy • autonomy rules"]
    B["B. Build the data foundation<br/>Calendars • tasks • notes • user preferences"]
    C["C. Build the core MVP<br/>Scheduling • conflict detection • briefings • follow-ups"]
    D["D. Add recommendations<br/>Generate options • filter conflicts • rank • explain"]
    E["E. Add safe autonomy<br/>Approval first • limited automatic actions later"]
    F["F. Test and improve<br/>Safety • accuracy • reliability • user feedback"]
    G["G. Private beta and launch<br/>Monitor • fix problems • gradually expand"]

    A --> B
    B --> C
    C -->|"First usable MVP"| D
    D --> E
    E --> F
    F --> G
    G -. "Continuous feedback" .-> D
```

## Phase tracker

| Phase | Outcome | Status |
|---|---|---|
| A. Plan the product | Approved product contract and scope | **In progress** |
| B. Build the data foundation | Trusted, read-only unified data model | Not started |
| C. Build the core MVP | First complete secretary loop | Not started |
| D. Add recommendations | Explainable next-action recommendations | Not started |
| E. Add safe autonomy | Guarded, reversible automatic actions | Not started |
| F. Test and improve | Validated safety, accuracy, and reliability | Not started |
| G. Private beta and launch | Monitored release with gradual expansion | Not started |

## Phase A — Plan the product

### Goal

Agree on exactly who the first version serves, what it must do, what it must not do, how recommendations behave, and which actions require approval.

### Already agreed

- Version 1 is a private, single-user assistant for June74, designed so it can expand later.
- Version 1 starts as a web app with conversational chat and a Today dashboard.
- Downloadable mobile and desktop clients are a later distribution target.
- Future desktop clients support optional launch at login and on-cue access; mobile clients use on-cue access and notifications.
- Google Calendar is the first calendar provider for version 1.
- Long-term calendar coverage includes calendars created in supported providers and calendars created directly inside Vision.
- Version 1 accepts chat messages, pasted text, and document or image uploads; email and voice capture follow later.
- The secretary covers school, work, and personal life.
- The core MVP collects calendar events, tasks, and notes.
- Users can request scheduling changes conversationally.
- The assistant detects conflicts and protects stated priorities.
- It produces morning and evening briefings.
- It extracts and tracks meeting decisions and follow-ups.
- It includes a recommendation system for next actions, preparation, schedule repair, and protected time.
- It supports autonomy levels rather than a single all-or-nothing permission setting.

### Decisions to make

- Priority and conflict-resolution behavior
- Recommendation categories and ranking principles
- Alert channels and notification limits
- Autonomy boundaries by action type
- MVP success measures
- Explicit non-goals for the first release

### Phase A completion checklist

- [x] Select the first user and release audience: June74 only for version 1.
- [x] Select the primary interaction surface: web app with chat and a Today dashboard.
- [x] Define future client activation: optional desktop auto-start plus on-cue access; mobile on-cue access and notifications.
- [x] Select the first calendar provider: Google Calendar.
- [x] Define the long-term calendar target: provider-created calendars plus Vision-native calendars.
- [x] Define the initial non-calendar capture sources: chat, pasted text, and document or image uploads.
- [ ] Define the canonical product objects: event, task, note, commitment, recommendation, preference, policy, and audit event.
- [x] Define cross-domain visibility and privacy behavior: shared planning facts, separated detailed content, and explicit reversible links.
- [ ] Define priority and conflict-resolution rules.
- [ ] Define recommendation categories, evidence, feedback, and ranking contract.
- [ ] Define autonomy levels and always-confirm actions.
- [ ] Define alerts, briefings, and notification limits.
- [ ] Write representative school, work, personal, and cross-domain scenarios.
- [ ] Define measurable MVP acceptance criteria.
- [ ] Record first-release non-goals.
- [ ] Review and approve the completed product contract.

### Cross-domain privacy model

- Use one shared planner for school, work, and personal scheduling.
- Share availability, deadlines, priority, duration, flexibility, location or travel needs, and protected-time status with the planner by default.
- Keep note bodies, attachments, event descriptions, meeting details, and other sensitive content inside their original domain by default.
- Allow the user to create explicit, inspectable, and reversible links when detailed information should cross domains.
- Reveal only the minimum necessary information in external actions; for example, say the user is unavailable without exposing a private event title.
- Preserve source, domain, privacy level, and permission provenance on every derived item.

## Preliminary MVP boundary

### Include

- One private user: June74
- Web app with conversational chat and a Today dashboard
- Google Calendar as the first provider, with the exact calendars selected during onboarding
- Chat and pasted-text capture for tasks, commitments, and notes
- Document and image uploads
- Cross-domain planning with domain-separated detailed content
- Proposed calendar changes with approval and undo
- Conflict and protected-time detection
- Morning and evening briefings
- Meeting decision and follow-up extraction
- Explainable schedule and next-action recommendations
- In-app alerts, with additional channels decided during Phase A

### Defer

- Autonomous communication or negotiation with attendees
- Meeting recording and transcription
- Email ingestion and voice capture or commands
- Purchases, reservations, and travel booking
- Team or shared-secretary workflows
- Multiple calendar providers and Vision-native user-created calendars
- Native mobile and desktop application packaging
- Unrestricted background autonomy
- A recommendation model trained across users

### Future distribution target

- Provide downloadable mobile and desktop clients after the web MVP is validated.
- Reuse the same secretary backend, policies, and synchronized data across every client.
- Let desktop users optionally launch the client at login while retaining voice, hotkey, and icon cues.
- Use on-cue access and notifications on mobile rather than requiring continuous background operation.

### Future calendar expansion target

- Expand beyond Google Calendar after the first provider integration is validated.
- Include every calendar the user selects from each supported external provider, including calendars the user created there.
- Allow the user to create and manage calendars directly inside Vision.

### Future capture expansion target

- Add email ingestion after the initial text and file capture flow is reliable.
- Add voice notes and voice commands for on-cue interaction after the web MVP.
- Keep meeting recording and transcription separate because they require additional consent and privacy controls.

## Decision log

| Date | Decision | Reason | Status |
|---|---|---|---|
| 2026-07-21 | Use one planner with shared planning facts, separated detailed memories, and explicit reversible cross-domain links. | Vision can coordinate the user's whole life without freely mixing or externally exposing sensitive school, work, and personal content. | Agreed |
| 2026-07-21 | Version 1 captures chat, pasted text, and document or image uploads; email and voice arrive later. | This supports useful note and commitment capture without making the first release depend on inbox access, audio processing, or background listening. | Agreed |
| 2026-07-21 | Long-term calendar coverage includes provider-created calendars and calendars created directly inside Vision. | Both sources are necessary for Vision to become the user's complete scheduling home rather than only an external-calendar viewer. | Agreed |
| 2026-07-21 | Use Google Calendar as the first provider; expand to broader calendar coverage later. | One provider keeps the first integration testable while preserving comprehensive calendar support as a later goal. | Agreed |
| 2026-07-21 | Future clients combine optional desktop launch at login with on-cue access; mobile uses on-cue access and notifications. | This keeps the secretary readily available without requiring continuous background activity on every device. | Agreed |
| 2026-07-21 | Start version 1 as a web app with chat and a Today dashboard; add downloadable mobile and desktop clients later. | A web foundation reaches the first usable version sooner while keeping the core experience portable to future clients. | Agreed |
| 2026-07-21 | Version 1 serves June74 only, while preserving a path to future expansion. | A private single-user release reduces authentication, tenancy, privacy, and onboarding scope while the core secretary loop is validated. | Agreed |
| 2026-07-21 | Serve school, work, and personal life in one product. | The secretary should coordinate the user's whole schedule. | Agreed |
| 2026-07-21 | Use autonomy levels. | Different actions carry different risk and should not share one permission switch. | Agreed |
| 2026-07-21 | Add an explainable recommendation system. | The secretary should proactively suggest useful next actions and schedule improvements. | Agreed |
| 2026-07-21 | Build an approval-based core MVP before guarded autonomy. | Trust, reversibility, and observable behavior come before automatic execution. | Agreed |

## Change policy

When this plan changes:

1. Update the relevant section.
2. Add or revise a decision-log entry when the change affects product behavior or scope.
3. Update the phase status and checklist.
4. Do not silently replace an agreed rule; mark it as superseded and record why.
