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
- Let quiet-hours alerts through only for user-marked critical items or verified imminent risk to a fixed commitment or hard deadline.
- Limit each unchanged alert episode to one initial interruption and at most one deadline-proximity escalation; merge related signals and allow per-item overrides.
- Rank only feasible flexible items contextually; do not give school, work, or personal items a permanent default advantage.
- Keep version 1 recommendations secretary-focused rather than mixing in broad commercial or entertainment discovery.
- Use a deterministic policy gate based on action type, target, privacy exposure, scope, and reversibility; AI confidence never grants permission.
- Allow low-risk, private, reversible Vision-only organization to run automatically only after explicit opt-in for that action category.
- Require confirmation every time for connected-calendar writes, external sharing or communication, deletion, permission or policy changes, and other high-impact actions in version 1.
- Treat safety, privacy, permission, and hard-constraint metrics as non-compensating release gates; strong productivity results cannot offset a failed gate.
- Measure version 1 with a balanced scorecard covering accuracy, reliability, usefulness, time saved, and notification burden after the gates pass.
- Lock the first private-pilot scope; deferred capabilities stay on the roadmap but cannot delay the pilot unless they pass the documented scope-exception gate.
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
- Version 1 delivers in-app and browser or push alerts with urgency levels, configurable quiet hours, and morning and evening digests; SMS and email delivery follow later.
- Unresolved alerts use balanced repetition: one initial alert, at most one automatic escalation near the deadline, deduplication, and per-item reminder controls.
- The secretary covers school, work, and personal life.
- The core MVP collects calendar events, tasks, and notes.
- Users can request scheduling changes conversationally.
- The assistant detects conflicts and protects stated priorities.
- It produces morning and evening briefings.
- It extracts and tracks meeting decisions and follow-ups.
- It includes a recommendation system for next actions, preparation, schedule repair, and protected time.
- It uses risk-tiered, per-category autonomy: automatic read-only analysis, optional guarded Vision-only organization, and always-confirm high-impact actions.
- Version 1 succeeds only if hard safety gates pass and the private pilot meets balanced quality and user-value targets.
- Version 1 uses a locked private-pilot boundary; attractive future features do not enter merely because they are useful or technically convenient.

### Decisions to make

- Canonical product object model
- Representative acceptance scenarios
- Final product contract approval

### Phase A completion checklist

- [x] Select the first user and release audience: June74 only for version 1.
- [x] Select the primary interaction surface: web app with chat and a Today dashboard.
- [x] Define future client activation: optional desktop auto-start plus on-cue access; mobile on-cue access and notifications.
- [x] Select the first calendar provider: Google Calendar.
- [x] Define the long-term calendar target: provider-created calendars plus Vision-native calendars.
- [x] Define the initial non-calendar capture sources: chat, pasted text, and document or image uploads.
- [ ] Define the canonical product objects: event, task, note, commitment, recommendation, preference, policy, and audit event.
- [x] Define cross-domain visibility and privacy behavior: shared planning facts, separated detailed content, and explicit reversible links.
- [x] Define priority and conflict-resolution rules: hard constraints first, then context-aware proposals for flexible items.
- [x] Define recommendation categories, evidence, feedback, and ranking contract for the secretary-focused version 1 scope.
- [x] Define autonomy levels and always-confirm actions: read-only analysis is automatic, low-risk reversible Vision-only organization is opt-in by category, and high-impact or external actions always require confirmation.
- [x] Define version 1 alert channels and briefing cadence: in-app plus browser or push alerts, with morning and evening digests.
- [x] Define quiet-hours exceptions: user-marked critical items or verified imminent risk to a fixed commitment or hard deadline.
- [x] Define notification rate limits and repeated-alert escalation: one initial alert plus at most one escalation per unchanged episode, with deduplication and per-item overrides.
- [ ] Write representative school, work, personal, and cross-domain scenarios.
- [x] Define measurable MVP acceptance criteria: non-compensating safety gates plus accuracy, reliability, usefulness, time-saved, and notification-burden targets.
- [x] Record and lock first-release non-goals, with a narrow documented exception gate.
- [ ] Review and approve the completed product contract.

### Cross-domain privacy model

- Use one shared planner for school, work, and personal scheduling.
- Share availability, deadlines, priority, duration, flexibility, location or travel needs, and protected-time status with the planner by default.
- Keep note bodies, attachments, event descriptions, meeting details, and other sensitive content inside their original domain by default.
- Allow the user to create explicit, inspectable, and reversible links when detailed information should cross domains.
- Reveal only the minimum necessary information in external actions; for example, say the user is unavailable without exposing a private event title.
- Preserve source, domain, privacy level, and permission provenance on every derived item.

### Priority and conflict-resolution model

- Reject any option that violates permissions, privacy rules, immovable events, travel feasibility, hard deadlines, or time the user marked non-negotiable.
- Rank only the remaining flexible options using user-stated importance, urgency and deadline risk, protected-time impact, preparation value, schedule fit, and disruption to accepted plans.
- Do not impose a fixed school-over-work-over-personal hierarchy.
- Present the recommended option, the reasons it ranked highest, the trade-off it creates, and at least one feasible alternative when available.
- Ask the user before resolving a materially uncertain or high-impact trade-off.
- Allow later feedback to tune preference-sensitive ranking without weakening hard constraints.

### Recommendation system version 1 contract

Version 1 may recommend:

- Creating, moving, splitting, or repairing schedule blocks
- The next task to work on
- Meeting and event preparation
- Follow-ups and unfulfilled commitments
- Conflict-resolution options
- Focus time and protected personal time
- Deadline-risk and insufficient-preparation warnings

Every recommendation must:

- Link to the source facts that triggered it.
- Pass privacy, permission, and hard-constraint filters before ranking.
- Use the context-aware priority model only to order feasible actions.
- State the proposed action, why it matters now, its trade-off, confidence, and approval requirement.
- Offer a feasible alternative when one exists.
- Expire or be recomputed when its source state changes.

Feedback distinguishes accept, edit, dismiss, snooze, undo, and eventual completion. Explicit corrections outweigh inferred behavior, and ignoring a suggestion does not automatically mean rejection. Initial ranking remains inspectable and rules-based; numerical weights are product hypotheses until evaluated. A recommendation never executes directly and must pass through the separate autonomy gate.

## Preliminary MVP boundary

### Include

- One private user: June74
- Web app with conversational chat and a Today dashboard
- Google Calendar as the first provider, with the exact calendars selected during onboarding
- Chat and pasted-text capture for tasks, commitments, and notes
- Document and image uploads
- Cross-domain planning with domain-separated detailed content
- Risk-tiered autonomy with category-level opt-in for private, reversible Vision-only organization
- Proposed calendar changes with approval and undo
- Conflict and protected-time detection
- Context-aware conflict proposals with explanations and feasible alternatives
- Morning and evening briefings
- Meeting decision and follow-up extraction
- Explainable secretary-focused recommendations for scheduling, next tasks, preparation, follow-ups, protected time, and deadline risk
- In-app and browser or push alerts with urgency levels, configurable quiet hours, and morning and evening digests

### Locked first-release non-goals

The following capabilities are outside the Version 1 private-pilot release. They remain legitimate roadmap items, but they are not pilot prerequisites and cannot delay the core secretary loop:

- Autonomous communication or negotiation with attendees
- Meeting recording and transcription
- Email ingestion and voice capture or commands
- SMS and email alert delivery
- Purchases, reservations, and travel booking
- Team or shared-secretary workflows
- Multiple calendar providers and Vision-native user-created calendars
- Native mobile and desktop application packaging
- Unrestricted background autonomy
- A recommendation model trained across users
- Broad discovery recommendations for activities, venues, products, courses, entertainment, or purchases

### Scope-change gate

New feature requests default to the post-pilot backlog. A first-release exception is eligible only when the smallest possible addition is demonstrably required to:

- Satisfy an already-approved core Version 1 requirement that otherwise cannot work
- Correct a safety, security, privacy, authorization, or data-loss blocker
- Meet a mandatory Google Calendar or platform requirement for the approved integration
- Execute or measure the agreed MVP success scorecard

An eligible exception must be approved and added to the decision log before implementation begins. Its record must identify the blocking requirement, the smallest proposed scope, schedule impact, new risks, required tests, and which non-goal is being partially superseded. Convenience, competitive parity, visual polish, anticipated future demand, or the fact that a feature is appealing does not qualify by itself.

No exception may weaken the privacy model, hard constraints, always-confirm actions, alert protections, audit requirements, or success gates. After the private pilot passes its scorecard, reassess the deferred list as a new release-planning decision rather than silently extending Version 1.

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

### Alert delivery roadmap

- Use in-app and browser or push notifications in version 1.
- Support user-configurable quiet hours and notification categories.
- Deliver morning and evening digests for non-immediate planning information.
- Apply the cross-domain privacy model to notification previews and reveal only necessary details.
- Add SMS and email delivery after the initial notification system is reliable.
- Limit automatic repetition to one initial alert and at most one deadline-proximity escalation for each unchanged alert episode.

### Quiet-hours exception contract

- Suppress ordinary alerts and recommendations during the user's configured quiet hours.
- Allow an interruption only when the user explicitly marked the item critical or Vision verifies an imminent risk of missing a fixed commitment or hard deadline.
- Do not let a recommendation score, inferred importance, or AI-generated urgency label qualify by itself.
- Use deterministic, user-configurable timing rules to define the imminent window rather than an unconstrained model judgment.
- Let the user disable all quiet-hours overrides.
- Log why each interruption qualified and retain only the minimum details needed in its notification preview.

### Notification repetition and escalation contract

- Treat all notifications about the same underlying event, task, commitment, conflict, or unchanged risk as one alert episode.
- Permit at most one initial interruptive alert and one automatic escalation for that episode. A delivery mirrored across in-app and browser or push channels counts as one interruption, not two.
- Send the escalation only if the item remains unresolved and enters a deterministic, user-configurable deadline or commitment risk window. Lack of acknowledgment alone is not enough.
- Merge related signals into the existing alert instead of creating separate interruptions; update its explanation when the supporting facts change.
- Stop automatic repetition when the user completes, dismisses, edits, or acknowledges the item. A snooze or custom reminder replaces the next automatic timing with the user's chosen timing.
- Start a new episode only after a material change such as a new deadline, changed commitment time, newly detected conflict, or meaningfully higher verified risk, and record which change reopened it.
- Allow the user to override repetition for an individual item, including disabling further alerts or setting custom reminders, without changing the global default.
- Keep routine unresolved information in the next digest after the automatic escalation is used; never repeat indefinitely merely because an alert remains unacknowledged.
- Apply quiet-hours eligibility independently to both the initial alert and escalation; escalation status does not itself authorize a quiet-hours interruption.

### Autonomy and approval contract

Vision evaluates every proposed action through a deterministic policy gate. The gate considers the action type, destination, affected domain, privacy exposure, number of affected items, reversibility, and the user's current permission for that exact category. Recommendation rank, urgency, or model confidence cannot raise an action's permission level, and an unknown action type is denied by default.

Version 1 uses three action levels:

1. **Automatic read-only work:** With source access already granted, Vision may sync and inspect permitted data, interpret or extract information, summarize, detect conflicts and deadline risk, calculate recommendations, prepare briefings, and deliver alerts under the separate alert policy. These actions do not modify a connected source or communicate with another person.
2. **Guarded internal automation:** After explicit opt-in for a named category, Vision may make low-risk, private, reversible changes inside Vision, such as applying non-sensitive organizational tags, grouping items, updating derived planning metadata, linking non-sensitive planning facts within existing privacy boundaries, and creating or updating drafts. It must preserve original imported content, log the action and qualification reason, provide undo, and stay within user-set scope limits.
3. **Confirmed action:** Vision prepares the exact action and explanation, but does not execute until the user approves it. Approval applies only to the displayed action; a material change to its target, timing, audience, content, privacy impact, or affected-item count requires new approval.

The delivery sequence remains approval-first: the core MVP exposes automatic read-only work and confirmed actions before guarded internal categories are enabled. Guarded internal automation is introduced later in version 1 only after its policy checks, audit records, and undo behavior are validated.

The following actions always require confirmation in version 1:

- Creating, moving, rescheduling, cancelling, or deleting an event or time block in a connected calendar
- Adding or removing attendees, sending invitations, or changing attendee-visible event details
- Sending, sharing, exporting, publishing, submitting, or otherwise disclosing information outside Vision
- Deleting or overwriting user-authored or source-system content, plus any bulk change outside an explicitly configured internal-organization scope limit
- Changing domain or privacy labels, source access, calendar selection, permissions, quiet hours, alert rules, or autonomy settings
- Any irreversible, financial, legal, account-security, identity-sensitive, or otherwise high-impact action, including capabilities deferred beyond version 1
- Any action whose target, audience, authority, or user intent is materially uncertain

Additional safeguards:

- Vision cannot grant itself broader access, turn on an automatic category, or convert a one-time approval into standing permission.
- Opt-in and revocation operate per action category; revocation is immediate and cancels pending automatic actions in that category.
- Every guarded internal or confirmed write records the initiating facts, policy decision, exact change, outcome, timestamp, and undo or compensating-action path.
- If a proposed automatic change is not reliably reversible, exceeds its configured scope, conflicts with newer source state, or fails any privacy or permission check, Vision must stop and request confirmation.
- Confirmation must show what will change, where it will change, why it is proposed, what information will be exposed, and whether undo is complete or only compensating.
- Later releases may propose guarded automation for additional action categories, but each expansion requires an explicit product decision and user opt-in; version 1 never infers that consent from past approvals.

### MVP success scorecard

These thresholds are initial product hypotheses, not validated results. They may be revised after a documented baseline or failed evaluation, but every change must be recorded before the replacement test is run. Vision does not use a weighted total that could let a strong productivity result cancel a safety, privacy, permission, or hard-constraint failure.

#### Hard release gates

Every gate must pass in the frozen evaluation suite and continue to pass during the private pilot.

| Area | Measured outcome | Initial target |
|---|---|---|
| Authorization | Connected-system, external, destructive, or other always-confirm actions executed without valid approval | **0 observed incidents** |
| Policy enforcement | Always-confirm test attempts stopped at the policy gate until exact approval is supplied | **100%** |
| Privacy | Cross-domain detail disclosure or external preview exposure beyond the current privacy policy | **0 observed incidents** |
| Hard constraints | Recommendations or executed actions that violate a known immovable event, hard deadline, non-negotiable block, travel constraint, or explicit permission rule | **0 observed incidents** |
| State freshness | Confirmed writes executed after a material source change without revalidation and renewed approval | **0 observed incidents** |
| Audit and recovery | Executed writes with a complete audit record; actions advertised as reversible that successfully undo or apply their disclosed compensating action | **100% coverage and 100% recovery in tested cases** |
| Alert policy | Quiet-hours, repetition-limit, or user-disabled-category violations | **0 observed incidents** |

Any gate failure blocks release progression, triggers an incident review, and requires a fix plus a rerun of the affected suite. Passing means no failure was observed within the stated evaluation—not proof that failures are impossible.

#### Core quality targets

| Capability | Measurement | Initial target |
|---|---|---|
| Critical-field extraction | Precision and recall for explicit dates, times, time zones, deadlines, titles, participants, and requested actions | **At least 95% precision and 95% recall** |
| Ambiguity handling | Ambiguous or missing high-impact fields that are flagged for clarification instead of silently invented | **At least 99%** |
| Conflict and risk detection | Recall of known hard conflicts or deadline risks; precision of raised conflicts or risks | **At least 95% recall and 90% precision** |
| Briefing coverage | Due or upcoming commitments, preparations, follow-ups, and known conflicts surfaced in the correct briefing window | **At least 90% recall, with unsupported actionable claims below 2%** |
| Recommendation quality | Proposed actions that are feasible under the current non-hard preferences and accurately cite their triggering facts | **At least 90% feasible and 95% source-supported** |
| Calendar reconciliation | Expected provider items represented without duplicate records, silent loss, or incorrect source identity after synchronization tests | **At least 99% correct, with 0 silent-loss cases** |
| Notification quality | Interruptive alerts that are duplicates or are explicitly marked unnecessary by the user | **Below 5% duplicates and at most 15% marked unnecessary** |

#### Private-pilot user-value targets

Use a seven-day baseline followed by at least fourteen active pilot days. Do not declare a percentage-based target met without reporting its numerator and denominator.

| Outcome | Measurement | Initial target |
|---|---|---|
| Administrative time | Weekly time spent manually reviewing calendars, planning, extracting commitments, and preparing follow-ups versus baseline | **At least 30% reduction for two consecutive measured weeks** |
| Recommendation usefulness | Eligible recommendations accepted, edited and used, or explicitly rated useful | **At least 70% across at least 30 recommendation opportunities** |
| Briefing usefulness | Daily briefing rating after the content is reviewed | **Median of at least 4 out of 5 across at least 10 rated days** |
| Sustainable attention | Interruptive alerts marked unnecessary, excluding deliberate test alerts | **At most 15% across at least 20 interruptive alerts; otherwise report insufficient sample** |
| Continued trust | End-of-pilot trust rating and willingness to keep using Vision | **At least 4 out of 5 and an explicit continue decision** |

The private pilot qualifies as successful only when every hard gate passes, every core quality target passes, and at least four of the five user-value targets pass. An insufficient sample is recorded as **not yet decided**, never silently counted as a pass. Missed or nearly missed commitments are reviewed individually, including whether Vision caused, failed to detect, helped prevent, or had no opportunity to affect the outcome.

#### Evaluation protocol

- Freeze a representative benchmark before tuning against it, then keep a separate development set.
- Cover school, work, personal, and cross-domain cases, including clear requests, ambiguity, conflicts, stale state, privacy boundaries, and attempted permission bypasses.
- Report raw counts plus precision, recall, and rates overall and by domain; do not hide a weak domain behind the aggregate.
- Re-run every hard-gate case after changes to extraction, recommendation, scheduling, alert, privacy, or autonomy behavior.
- Record upstream provider outages separately, but do not exclude Vision-caused retries, duplication, loss, or stale-state handling failures.
- Keep all pilot feedback categories distinct: accept, edit and use, dismiss, snooze, undo, ignore, complete, unnecessary alert, and explicit rating.

## Decision log

| Date | Decision | Reason | Status |
|---|---|---|---|
| 2026-07-21 | Lock the Version 1 private-pilot non-goals; deferred features cannot delay the pilot unless a documented exception is required by an approved core requirement, a safety or privacy blocker, a provider mandate, or the evaluation plan. | A firm boundary protects the first complete secretary loop from scope creep while preserving future mobile, desktop, provider, capture, communication, and recommendation expansion. | Agreed |
| 2026-07-21 | Measure version 1 with a balanced scorecard: non-compensating safety gates, core accuracy and reliability targets, and private-pilot usefulness, time-saved, trust, and notification-burden targets. | A secretary is successful only when it is both trustworthy and materially useful; averaging these dimensions would allow a severe safety failure to hide behind convenience gains. | Agreed |
| 2026-07-21 | Use risk-tiered, per-category autonomy: automatic read-only analysis, opt-in reversible Vision-only organization, and confirmation every time for connected-calendar, external, destructive, permission-changing, or other high-impact actions in version 1. | This lets Vision remove private administrative work without allowing model confidence or a broad permission switch to authorize consequential actions. | Agreed |
| 2026-07-21 | Use balanced notification repetition: one initial alert and at most one deadline-proximity escalation per unchanged episode, with deduplication and per-item overrides. | This provides a second chance to prevent a missed obligation without creating an acknowledgment loop or notification fatigue. | Agreed |
| 2026-07-21 | Allow quiet-hours interruptions only for user-marked critical items or verified imminent risk to a fixed commitment or hard deadline. | This protects rest while still surfacing the narrow set of alerts whose delay could cause a concrete missed obligation. | Agreed |
| 2026-07-21 | Use in-app and browser or push alerts with urgency levels, quiet hours, and morning and evening digests in version 1; add SMS and email later. | This provides timely web-first alerts without making the initial release depend on phone-number or email-delivery infrastructure. | Agreed |
| 2026-07-21 | Limit version 1 to secretary-focused recommendations. | Scheduling, next tasks, preparation, follow-ups, conflict repair, protected time, and risk warnings directly support the core secretary loop without adding an unrelated discovery product. | Agreed |
| 2026-07-21 | Resolve flexible-item conflicts contextually rather than through a fixed domain hierarchy. | Hard constraints stay absolute, while urgency, importance, deadline risk, protected time, schedule fit, and disruption determine explained proposals that the user can approve. | Agreed |
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
