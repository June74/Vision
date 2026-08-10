# SB-20260802-032510-task8-owner-auth-account-not-allowed: Owner sign-in reached the private allowlist denial

- **Status:** closed
- **First observed:** 2026-08-02T03:25:10.7721113Z
- **Last observed:** 2026-08-02T05:32:26.8942986Z
- **Phase/task:** Phase B Task 8 owner authentication acceptance
- **Environment:** Deployed preview Worker
- **Version/commit:** `4420f6d`

## Symptom

After completing Google authorization, Vision displayed its constant access
denial page for an account that was not admitted by the private owner
allowlist.

## Impact

The owner session was not created, so the remaining live Phase B acceptance
sequence could not proceed. Vision did not reveal any identity, claim,
allowlist, callback, or token value.

## Reproduction conditions

Complete a fresh preview Google callback with an identity or trust claim that
does not exactly match the server-only private owner allowlist.

## Safe evidence

- The fixed 403 access-denial page was observed by the project owner.
- The source path maps that page only to an `IdentityAuthorizationError` after
  callback parsing, transaction consumption, token exchange, scope validation,
  ID-token verification, and required claim validation have succeeded.
- The corresponding safe event is `action: auth.callback`, `outcome: denied`,
  and `errorCategory: account_not_allowed`.

## Attempts and outcomes

- A fresh root-page read confirmed the preview currently loads signed out and
  exposes exactly one server-owned sign-in link.
- A filtered long-running tail was started that can emit only an allowlisted
  authentication category.
- The tail did not connect because local Wrangler authentication was
  unavailable; no Worker event was read.
- Signed-in Cloudflare inspection verified exactly one
  `GOOGLE_ALLOWED_EMAIL` row and one `GOOGLE_ALLOWED_SUB` row, both typed as
  Secret. Cloudflare does not return either stored value for comparison.
- The prior successful-login source path persists the Google subject in
  `google_oauth_tokens.google_subject`, providing a value source the owner can
  transfer directly without returning it to Codex.
- A privacy-safe Neon query verified exactly one newest source row. A second
  query prepared that one subject in the owner's Neon tab and verified only
  that one result row exists; the value never entered tool output.
- The owner replaced only `GOOGLE_ALLOWED_SUB` from that private source. The
  value did not enter chat or tool output; fresh live verification is pending.
- A fresh sign-in after that replacement again reached the same fixed access
  denial page, with no generic authentication failure.
- The owner then replaced only `GOOGLE_ALLOWED_EMAIL` with the email for the
  same account. The rendered application accepted the owner session and loaded
  the connected setup's calendar foundation instead of the denial page.
- The safe foundation state is currently `Disconnected`; a fresh Google
  reconnect was opened only after the verified callback observer became
  active.

## Cause classification

- **Confirmed cause:** The callback reached the exact private identity
  authorization boundary because the email allowlist secret no longer matched
  the intended owner account. Replacing that one secret cleared the denial.
- **Hypotheses:** None remaining for the allowlist incident. The separate stale
  synchronization checkpoint is tracked independently.
- **Rejected hypotheses:** Callback transaction, token exchange, scope, token
  signature, and required claim-shape failures produce the separate generic
  authentication-failure page, not this denial page. The owner confirms the
  intended Google test account was selected, rejecting accidental account
  selection as the current explanation. Replacing the subject alone did not
  resolve the denial, rejecting the earlier subject-only explanation. The
  post-email-change rendered owner session rejects a continuing total
  allowlist denial, but the callback category remains pending.
- **Known exclusions:** Missing or syntactically invalid runtime bindings would
  fail dependency initialization and would not produce this page.

## Correction and prevention

- **Correction:** Keep the subject from the prior successful-login source and
  the email for that same account as the two private allowlist secrets, then
  complete one fresh reconnect under the safe callback observer.
- **Prevention:** Preserve one safe live callback-category check in release
  acceptance and verify the intended owner account before changing allowlist
  configuration.
- **Owner:** Project owner for account selection and secret entry; Codex for
  diagnosis and verification.
- **Next diagnostic step:** None for the closed allowlist incident.

## Verification and related work

Unit tests cover the pure identity rejection conditions, Worker tests cover
private callback rejection behavior, and end-to-end tests cover the fixed 403
page. After the email replacement and fresh reconnect, the provider interaction
returned to Vision's authenticated foundation without either denial or generic
authentication failure. The remaining `Disconnected` state was traced to a
separate persisted synchronization checkpoint, not the owner allowlist.

## Recurrence history

- 2026-08-02T03:25:10.7721113Z: First observed and contained at the allowlist
  boundary; no private value was copied or logged.
- 2026-08-02T04:22:30.8197307Z: Cloudflare verified both allowlist names and
  Secret types, but values remained write-only. The owner confirmed the
  intended test account was used. The minimal next test replaces only the
  subject from Vision's prior successful-login record; no credential or key
  has been changed yet.
- 2026-08-02T04:27:02.8071644Z: Neon verified one prior subject source row and
  left its private value ready for owner-controlled copy. No value was returned
  to Codex and no Cloudflare Secret or key has changed yet.
- 2026-08-02T04:48:00.7603620Z: The owner confirmed that only
  `GOOGLE_ALLOWED_SUB` was replaced from the prepared private source. No value
  was returned to Codex, and no backup or encryption key changed. Live sign-in
  verification remains pending.
- 2026-08-02T04:52:47.4860041Z: A fresh owner sign-in after the subject
  replacement again reached the same fixed allowlist denial. No account,
  callback, token, or secret value was read or retained. The subject-only
  hypothesis is rejected and the remaining configuration boundary is under
  read-only diagnosis.
- 2026-08-02T05:18:43.7796499Z: After the owner replaced only the email
  allowlist secret, Vision rendered the authenticated calendar foundation
  instead of denial. The safe state was `Disconnected` with a successful
  zero-event read, so a fresh reconnect was opened under the active safe
  callback observer. No private value was read or retained.
- 2026-08-02T05:32:26.8942986Z: The fresh provider interaction returned to the
  authenticated Vision foundation without denial or generic authentication
  failure. A privacy-safe aggregate query proved a token exists, closing the
  allowlist incident. The independent stale-checkpoint defect remains
  contained in its own incident.
