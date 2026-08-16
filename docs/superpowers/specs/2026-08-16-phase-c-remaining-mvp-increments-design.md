# Phase C remaining MVP increments design

**Status:** Approved for implementation after explicit live/private-pilot authorization on 2026-08-16.

**Scope boundary:** Continue Phase C from the locally verified authenticated one-off write surface through the remaining secretary MVP increments. Use only the existing single-user Vision calendar and an explicitly disposable preview/private-pilot fixture. Production deployment, production database migration, production secrets, and irreversible external changes remain separate gates.

**Concurrency hardline:** **No more than 20 agents at once. This is a hard line.** The implementation remains inline with 0 active agents.

## Goal

Complete the remaining Phase C product scope with the same preview, explicit approval, freshness check, provider mutation, verified read-back, audit, and recovery contract already used by one-off create.

## Existing boundary

The current branch already contains:

- a provider-neutral immutable create proposal and lifecycle;
- an encrypted, owner-scoped approval repository;
- a durable exactly-once execution ledger;
- a bounded Google one-off create/read/delete adapter;
- authenticated preview, status, confirm, and undo routes;
- a browser one-off composer with truthful pending and verified undo states;
- local tests, TypeScript checks, build checks, documentation checks, and release-surface checks.

The current local boundary has not made a live provider call, applied migration `0010` to the preview database, deployed the Phase C branch, or changed production state.

## Increment A — live acceptance of the current one-off surface

Use the existing isolated preview Worker and a disposable Vision-calendar fixture. The acceptance record may retain only safe facts: timestamp, reviewed commit, HTTP status, operation outcome, opaque operation digest, event-count/absence facts, and privacy-safe audit categories. It must not retain account identifiers, calendar IDs, event titles, tokens, URLs containing credentials, response bodies, or database content.

The acceptance sequence is:

1. Verify preview health and authenticated read access.
2. Apply the reviewed Phase C schema to an explicitly disposable preview database target, or stop before deployment if the target cannot be independently identified as disposable.
3. Deploy only the reviewed Phase C preview artifact through the existing preview admission path.
4. Preview one uniquely marked, notification-free event.
5. Confirm it using the exact confirmation phrase.
6. Prove one provider create, exact read-back, owner-scoped status, and replay safety.
7. Undo the verified event and prove provider absence.
8. Recheck status and prove no second delete or create occurred.
9. Capture privacy-safe application/audit evidence.
10. Restore the normal preview runtime and independently verify health, authenticated reads, and temporary fixture absence.

Any uncertain provider result remains pending. No live acceptance claim is made from local mocks or a healthy endpoint alone.

## Increment B — one-off mutation parity

Add update, move, cancellation, and direct-delete as distinct action types through the shared pipeline. Each action must have:

- an immutable before/after preview;
- server-derived owner, calendar, event identity, and provider version;
- an exact confirmation phrase;
- immediate provider version revalidation;
- one owner-scoped durable operation claim;
- provider uncertainty reconciliation without blind retries;
- exact post-mutation read-back;
- privacy-safe audit facts;
- a verified compensating path or a truthful non-reversible cancellation explanation.

Direct delete is destructive and always confirmation-based. Cancellation is a provider status mutation and must not be silently represented as deletion. Move is a time-field update, while update may change only fields explicitly shown in the preview.

## Increment C — recurrence, attendees, and notifications

Extend the preview contract so the user can see recurrence rules, occurrence-versus-series scope, attendee impact, and notification policy before confirmation. The server must reject ambiguous recurrence scope, hidden attendees, unsupported notification combinations, malformed rules, and stale series/occurrence versions.

The provider adapter must normalize recurrence and attendee outcomes into a bounded provider-neutral shape. Notification behavior must be explicit: `none`, provider-default, or the supported controlled policy. No provider-generated notification is described as suppressed unless the adapter proves the requested policy.

## Increment D — Vision-local secretary flows

Add independently useful local capture and planning flows for:

- conversational text capture into a previewed typed item;
- Today view with deterministic date and timezone handling;
- tasks with due dates, completion, and safe undo;
- notes with protected content encryption and owner-scoped reads.

These flows must not silently authorize a connected-calendar change. A captured item may produce a calendar proposal, but the proposal remains a separate explicit approval operation.

## Increment E — scheduling, briefings, and follow-ups

Add deterministic scheduling proposals and conflict explanations from the existing planning-safe event projection. A proposal must expose its source facts, hard constraints, timezone assumptions, and unresolved ambiguity. It must never write a calendar event without the shared confirmation pipeline.

Add template-backed briefings and follow-up records before optional AI wording. AI may classify, summarize, or explain only through existing privacy, budget, and policy gates; it cannot grant permission, select hidden attendees, or bypass confirmation.

## Cross-cutting acceptance gates

Every connected-write increment requires focused unit/contract/Worker/browser tests, source and test TypeScript checks, build and release-surface checks, privacy-safe documentation, and a fresh preview acceptance before the next connected write surface is enabled.

The user-facing proof is: a user can inspect the exact proposal, deliberately confirm it, observe verified or pending state, recover without a duplicate mutation, and see the provider state match the disclosed result. If that action cannot be executed in the authorized preview environment, the result is recorded as locally verified with live acceptance pending.

## Explicit non-goals

- No production deployment or production database migration in this continuation without a separate explicit release approval.
- No autonomous communication or attendee negotiation.
- No email ingestion, voice capture, recording, or transcription.
- No shared organization calendar or multi-provider expansion.
- No AI-generated authorization or automatic confirmation.
- No secret, token, account identifier, raw event content, or private provider response in source control or evidence.
