# SB-20260812-030919-foundation-closure-config-key

- Incident ID: `SB-20260812-030919-foundation-closure-config-key`
- First observed: `2026-08-12T02:40:02Z`
- Last observed: `2026-08-12T03:09:19Z`
- Status: `contained`
- Phase/task: Phase B foundation-probe monitored acceptance and rollback closure
- Environment: GitHub Actions preview workflow, Cloudflare preview Worker
- Version/commit: `12fc33353a9363bf051991cf6014500b586927df`

## Symptom

The foundation-probe observer and candidate deployment completed, and the
rollback workflow completed successfully. The closure workflow then failed at
`Reverify normal provider state before rollback closure`. The controller
returned `failed_closed` after dispatching the closure workflow.

## Impact

The candidate was restored by the successful rollback workflow. The closure
proof was not produced, so the acceptance chain is not complete and no later
candidate is authorized from this evidence. No secret value, backup key,
database, calendar, or application data was changed.

## Cause classification

- **Confirmed cause:** the closure workflow computes its public preview origin
  from `config.vars.GOOGLE_OAUTH_REDIRECT_URI`, but the tracked Worker config
  defines `GOOGLE_REDIRECT_URI`. The wrong key produces an invalid origin before
  the closure provider-state check can complete.
- **Supporting source evidence:** `wrangler.jsonc` contains
  `GOOGLE_REDIRECT_URI`; no tracked `GOOGLE_OAUTH_REDIRECT_URI` configuration
  exists. The failing closure step is the only workflow location using the
  wrong key.
- **Confirmed rollback state:** the rollback workflow completed successfully;
  the failure is in post-restore closure verification, not candidate deploy or
  normal restore.
- **Rejected hypothesis:** missing temporary restore secrets are not relevant
  to this foundation-probe path; its candidate and rollback jobs passed without
  them.

## Diagnostic attempts

- Read-only job inspection showed candidate success, rollback success, and the
  closure failure step. A bounded classifier found transport/error markers but
  no safe provider category because the failure occurred while deriving the
  public origin.
- One read-only GitHub status retry hit a transient TLS handshake timeout and
  returned no usable status; the next retry succeeded. No provider mutation or
  data exposure occurred.
- The first focused test command used `pnpm exec vitest`, which this Windows
  checkout did not resolve. The same test then ran successfully through the
  explicit local `vitest.cmd` launcher; no repository or provider state changed.

## Correction and prevention

Add a workflow contract test that derives the closure origin from the tracked
`GOOGLE_REDIRECT_URI` key, then change only the closure workflow reference to
that key. Keep the candidate and rollback contracts unchanged. Rerun the
focused workflow test, documentation/security checks, and one fresh monitored
foundation-probe acceptance at the new reviewed tip.

## Next step

Implement and verify the one-key workflow correction. The preview is currently
restored by rollback, but the closure artifact must be produced before Phase B
acceptance can be claimed.

## Verification

The regression test failed against the old workflow and passed after changing
the key. The focused workflow YAML suite passed (5 tests), the full unit suite
passed (1,767 tests, 6 skipped), contract tests passed (183), typecheck passed,
documentation coverage passed, and the production build passed with the known
local Wrangler log-file permission warning. A fresh monitored acceptance at the
new commit is still required.
