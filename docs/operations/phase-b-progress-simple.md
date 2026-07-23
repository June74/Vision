# Phase B Progress — Simple Guide

This page explains Phase B progress in concise, plain language. It is updated after each reviewed task.

## Current milestone

Domain, data, and privacy.

## Completed

### Runtime Task 1 — Application foundation

Vision now has its first working application shell:

- A React page that displays `Vision` and `Foundation status`.
- A Cloudflare Worker API with a health check.
- Strict TypeScript configuration.
- A production build that completes successfully.
- A simple and a technical reference for every production file created in this task.

The task was independently reviewed and approved with no findings.

### Runtime Task 2 — Automatic checks

Vision now automatically checks that:

- Every production file and function has both the simple and technical explanation.
- Meaningful folders have both explanation layers.
- Source files and functions contain the required code documentation.
- The Worker health endpoint behaves correctly inside the Cloudflare-compatible runtime.
- Chromium can open the application and see the expected Vision screen.

The task required several focused corrections to avoid missing or incorrectly rejecting valid documentation. After those corrections, independent review approved it with no remaining findings.

### Runtime Task 3 — Safe errors and logs

Vision now gives API errors a consistent, private response containing only a safe code, message, and random request ID. Its structured logger rejects unexpected or hidden fields before anything is written, and entity references must use opaque UUIDs instead of private text.

Even if the logging destination fails, Vision still returns the safe API response. Independent review approved the hardened implementation with no remaining findings.

### Runtime Task 4 — Delivery safeguards

GitHub can now check every proposed change automatically. Preview and production workflows verify one exact commit and deploy that same commit, so a branch cannot change while approval is waiting. Production also requires an exact confirmation phrase in addition to its GitHub environment gate.

The repository implementation passed review. The hosted preview is live at
`https://vision-preview.june74.workers.dev`: its page renders `Vision` and
`Foundation status`, and its health endpoint returns the expected safe response.
The Runtime and continuous integration milestone is complete.

## In progress

### Domain Task 1 — Canonical records and categories

Vision now has provider-independent definitions for its graph, events,
categories, and privacy levels. Every canonical record must have a complete
provider or first-party identity, category values cannot contradict their
confirmation state, and AI inference cannot lower privacy or authorize
sharing.

The task passed 17 focused tests and the full project check. Independent
review initially found two contract gaps; both were corrected, tested, and
approved with no remaining findings.

### Domain Task 2 — PostgreSQL foundation

Vision now has a reviewed eight-table PostgreSQL design for canonical records,
events, relationships, audit facts, synchronization state, operation records,
and recoverable deletion. Automated checks compare the reviewed SQL, Vision's
typed schema, and generated migration snapshot so a weakened constraint or
protected-field type cannot drift silently.

Database writes now protect owner boundaries even when two synchronizations
race. Vision accepts only a dedicated `vision_app` database credential and
returns safe identity conflicts without exposing private values.

The task required several review and repair rounds. Final independent review
approved both the specification and implementation quality with no remaining
findings. No live Neon database has been created or contacted yet.

### Domain Task 3 — Protected-field encryption

Vision can now encrypt private calendar and note fields with authenticated
AES-256-GCM envelopes. Each field is bound to its owner, record, field name,
category, and key version, so encrypted values cannot be moved to another
context. Per-user/category keys support safe rotation and historical
decryption without allowing version rollback.

Security checks also keep the test key provider out of production builds,
bound hostile input sizes before decoding, and validate the Worker root key
without exposing it. The task passed 36 focused crypto tests, 71 unit tests,
and final independent review with no remaining findings.

### Domain Task 4 — Encrypted persistence and safe audit

Vision now encrypts protected event content before PostgreSQL persistence,
keeps planning queries free of encrypted payloads, and decrypts only after a
private owner-and-privacy authorization decision. Safe audit records accept
only a fixed metadata allowlist and reject protected or unexpected values.

Database writes enforce strict provider ordering and exact node facts. The
matching node is locked for the event write so a concurrent category, privacy,
or version change cannot silently admit content under stale rules.

The task passed 100 main tests and 4 Worker tests. Final independent review
approved both the specification and implementation quality with no findings.
A live Neon concurrency check remains a later external acceptance gate.

### Next — Recoverable deletion

Add the 30-day encrypted recovery window, restoration before its boundary,
and irreversible ciphertext/relationship purging at or after the deadline.

## Not yet included

No Google login, calendar connection, database, AI, alerts, or production deployment exists yet.
