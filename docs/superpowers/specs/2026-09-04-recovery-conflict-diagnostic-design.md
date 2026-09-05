# Recovery conflict diagnostic: approved design

The owner approved implementation, tests, and preview deployment in this task.
This records that approved diagnostic-only scope; it does not authorize another
authentication eligibility change. Hard line: **no more than 20 agents at once**.

## Evidence and objective

The owner still receives `callback_authorization_recovery_failed`. Their latest
read-only result contains one matched calendar, older maintenance, and a connected
unmarked checkpoint. These predicates meet the deployed lag alternative, but do
not prove the callback's exact token metadata or successful SQL execution.

Confirmed path: `createApp` -> `registerOAuthRoutes` -> Google callback -> encrypted
token persistence -> `authorizationRecovery.recoverAfterReconnect` ->
`recoverAuthorizationAfterReconnect` -> closed outcome check -> session issuance.

## Contract

Add only `callback_authorization_recovery_conflict` to the existing closed
diagnostic tuple. Emit it only after the recovery port returns exactly `conflict`.
Keep `callback_authorization_recovery_failed` for execution exceptions and invalid
outcomes. The existing wrapper preserves inner tags and preview-only header/page
disclosure; the existing safe logger continues to validate its closed enum.

No raw errors, SQL text/parameters, tokens, request values, identities, or secrets
are copied into a stage. Preserve statuses, redirects, cookies, audit category,
session rotation/creation ordering, and exact local/production failure HTML.
Only `recovered` and `not_needed` continue to admit sessions. No repository SQL,
database record, migration, secret, provider setting, or production deployment is
changed. The original diagnostic stays until real sign-in succeeds.

## Verification and release

Test the actual Worker route with controlled port outcomes across preview, local,
and production: conflict, database-like throw, identity-shaped throw, invalid
values, and both accepted outcomes. Assert response, safe log, retained token
persistence, unchanged prior session, and no new session/cookie on failure.
Exercise the log enum and existing parameterized SQL contracts. Run full checks,
browser tests, and independent review before pushing the Phase C branch and
deploying the exact reviewed commit with the normal preview workflow. A successful
deployment is diagnostic availability, not proof of successful owner sign-in.
