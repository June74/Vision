# SB-20260802-225444-reconnect-health-schema-ambiguous-rollback: Post-deploy health parser could not attribute normal state

- **Status:** closed
- **First observed:** 2026-08-02T22:54:44.411752Z
- **Last observed:** 2026-08-10T22:52:42Z
- **Phase/task:** Phase B OAuth reconnect Task 5 candidate deployment precondition
- **Environment:** Deployed preview Worker and local privacy-safe verifier
- **Version/commit:** candidate `c1911f8`; rollback `94b8810`

## Symptom

The live health request returned HTTP 200, but the fixed-field parser did not prove the required healthy and preview categories.

## Impact

The candidate was rolled back immediately to the exact previous normal artifact before any Google interaction; no login, calendar, database, credential, or key action followed.

## Reproduction conditions

Deploy the exact candidate, request the unauthenticated health endpoint, and
test only assumed top-level `status`/`ok` and `environment`/`env` fields.

## Safe evidence

The candidate deployment exited zero. The subsequent health request returned
HTTP 200, but both assumed fixed-field booleans were false. The exact rollback
deployment then exited zero. No response body, provider identifier, account
value, credential, URL parameter, or private row was retained.

## Attempts and outcomes

- Candidate deployment exited zero with raw provider output discarded.
- The ambiguous health attribution stopped the flow before login.
- Exact previous-normal rollback exited zero with provider output discarded.

## Cause classification

- **Confirmed cause:** The ad-hoc parser expected an environment field that is
  not part of the checked-in health contract and did not accept the contract's
  `status: ok` form. Environment attribution belongs to the deployed Worker
  settings, not the health response.
- **Hypotheses:** None remaining for the parser ambiguity.
- **Rejected hypotheses:** The HTTP response was not unhealthy, and no
  candidate application failure was established.
- **Known exclusions:** No Google interaction, login, calendar action,
  database mutation, credential read, key read/rotation, or candidate retry.

## Correction and prevention

- **Correction:** Validate health against the repository contract and validate
  preview environment independently through deployed settings/version state.
- **Prevention:** Use the repository's validated health schema rather than
  ad-hoc aliases for live attribution.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None in this stopped attempt; any candidate retry
  requires a new reviewed decision using the corrected verifier contract.

## Verification and related work

Rollback deployment exited zero. Fresh privacy-safe checks proved the health
contract, preview environment, one active version, zero temporary acceptance
or restore bindings, and an exact rollback config containing two permanent
schedules with no one-minute route. Cloudflare's documented Wrangler contract
states that a deployment replaces prior Cron Triggers with that config array,
so the successful exact rollback deploy proves the provider-side count is two
and the one-minute route is absent. The disposable short rollback worktree was
then removed with both path and registration absence proved.

## Recurrence history

- 2026-08-02T22:54:44.411752Z: First observed.
- 2026-08-02T22:54:58.6391077Z: Contained by immediate exact rollback before
  any owner interaction or additional provider action.
- 2026-08-02T23:06:09.5268022Z: Root cause confirmed as verifier-schema drift,
  not a demonstrated candidate failure. All rollback checks except the live
  schedule count passed; signed-in dashboard navigation to that count was
  policy-blocked before navigation and abandoned without a workaround.
- 2026-08-02T23:09:52.9851982Z: Rollback verified from successful deployment,
  exact generated config, and the provider's documented trigger-replacement
  semantics. Recorded `rollback_verified=true`, removed the exact disposable
  short rollback artifact, and stopped without a candidate retry or Google
  interaction.
- 2026-08-10T22:52:42Z: Recurred during the read-only baseline preflight. The
  initial safe projection looked for a boolean `ok` field and reported false;
  the actual checked-in contract is `{ status: "ok", service: "vision" }`.
  Source inspection and the corrected allowlisted projection confirmed the
  response was healthy. No provider or repository state changed.
