# Cloud integration debugging retrospective

This note records the Cloudflare, Neon, and Google OAuth problems encountered while connecting the Vision preview environment. It intentionally contains no secret values, account identifiers, email addresses, authorization codes, tokens, database URLs, encryption keys, or auth-bearing callback URLs.

## Outcome

The deployed preview ultimately completed a real allowed-user Google sign-in, connected the secondary Vision calendar, verified that the new calendar contained zero events, and preserved the authenticated session after reload.

Two callback-transaction defects have confirmed root causes:

1. The installed Neon driver ignored the attempted per-connection PostgreSQL `bytea` parser configuration. Vision therefore did not decode stored binary OAuth fields through the parser path the code expected.
2. Neon returned PostgreSQL timestamps with short UTC offsets such as `+00`, while Vision accepted only `Z` or a full offset such as `+00:00`.

The final saved authentication change set also:

- ignored benign Google `profile` scopes during scope comparison;
- accepted the short Neon timestamp offsets; and
- explicitly bound Worker network calls to `globalThis.fetch`.

Live sign-in succeeded after that change set. The available evidence proves the two transaction defects above, but it does not isolate which later-stage change was solely responsible for the last real-Google failure. Do not rewrite that history as a more specific root cause without a captured callback category proving it.

## What made the debugging take so long

### 1. Mocked database behavior differed from the installed Neon driver

The initial `bytea` fix looked correct in isolated tests but used a connection option that the installed Neon driver silently ignored. The application therefore passed mock-based checks while the deployed connector still behaved differently.

Resolution:

- reproduce the row through the real installed driver boundary;
- register the `bytea` parser in the parser registry the driver actually uses;
- add a contract test that decodes a complete OAuth transaction row, not only an isolated field.

Recorded fix: commit `9d1c63d`.

### 2. PostgreSQL returned a valid timestamp shape the decoder rejected

The callback transaction was successfully stored and retrieved, but decoding failed because the database returned a short offset such as `+00`. The decoder accepted `Z` and full `+HH:MM` offsets only.

Resolution:

- normalize a valid short offset to `+HH:00` before parsing;
- cover both short and full PostgreSQL offsets in contract tests;
- keep invalid dates and unsupported forms fail-closed.

Recorded fix: commit `7f57430`.

### 3. A synthetic callback was mistaken for broader OAuth proof

An intentionally fake Google authorization code advanced to `token_exchange_failed`. That was useful: it proved Vision created, retrieved, decoded, consumed, and decrypted the OAuth transaction. It did **not** prove that a real Google token exchange, scope check, identity check, token persistence, or session creation would succeed.

Resolution:

- treat each safe callback category as one stage boundary;
- after the synthetic test, run one fresh real sign-in while live logs are active;
- diagnose only the newest `action: auth.callback` `errorCategory`.

### 4. Several layers used similarly named Cloudflare values

The Cloudflare API token and Cloudflare Account ID are different values:

- `CLOUDFLARE_API_TOKEN_PREVIEW` is a secret credential authorizing the deployment.
- `CLOUDFLARE_ACCOUNT_ID_PREVIEW` is the identifier of the Cloudflare account that owns the Worker. It is not an API token.

A “GitHub to Cloudflare” token can be the preview API token if it is scoped to the correct account and minimum Worker deployment permissions. It cannot also be the Account ID, and the same value must not be placed in both fields.

The deployment values belong in the protected GitHub `preview` environment. Application runtime secrets such as the database connection, Google credentials, allowlist, and encryption key belong in the Cloudflare Worker secret store. Non-secret runtime settings belong in Worker variables. Mixing those three locations produces failures that look similar but occur at different stages.

### 5. Live tooling failures were confused with application failures

- A short Wrangler Tail command ended before the real callback arrived.
- A background PowerShell attempt encountered a `PATH`/`Path` name collision.
- Non-interactive Wrangler inspection lacked a usable Cloudflare login/token.
- GitHub Actions displayed Node runtime deprecation warnings even though the actions were being forced onto the newer runtime; those warnings were not the OAuth failure.

Resolution:

- keep Wrangler Tail running in a long-lived command cell;
- use browser/live acceptance when non-interactive deployment inspection has no authorization;
- classify warnings separately from failed steps;
- never request, print, or store a Cloudflare or OAuth secret merely to make diagnostics convenient.

### 6. Local, GitHub, and deployed state were easy to confuse

A change can be saved in the worktree but uncommitted, committed locally but not pushed, pushed but not deployed, or deployed from a different commit. “Recent pushes” on the branch do not prove the browser is running those files.

Resolution:

- inspect the active worktree, branch, status, and exact commit before rewriting or pulling;
- run local verification on the saved change;
- deploy or verify the immutable commit intended for preview;
- confirm the live behavior after deployment.

## The debugging sequence that finally worked

1. Inspect the correct worktree and branch, then verify whether the other tool's changes are actually saved.
2. Review the diff before changing it.
3. Run TypeScript, contract, Worker, documentation, build, and security-boundary checks locally.
4. Exercise the real Neon driver and complete persisted OAuth row.
5. Use a synthetic callback only to identify how far the transaction path progresses.
6. Start a long-running safe Wrangler Tail.
7. Perform exactly one fresh real Google sign-in, with the user entering credentials and granting permissions directly.
8. Read only the newest safe `auth.callback` category; do not inspect or copy the callback URL, code, token, claims, email, or provider body.
9. Fix and test that exact stage.
10. Verify the exact preview commit in the browser: connected state, expected setup version, verified zero-event secondary calendar, and session persistence after reload.

## Mandatory checklist for the next integration

Before debugging:

- [ ] Confirm the active worktree, branch, commit, and deployed commit.
- [ ] Make a value-location worksheet containing only variable **names**: value type, secret or identifier, source console, destination, and safe verification method.
- [ ] Confirm the Cloudflare API token and Account ID are different values with different purposes.
- [ ] Confirm GitHub deployment secrets, Worker runtime secrets, and non-secret Worker variables are in their correct stores.
- [ ] Confirm the Google redirect URI matches exactly in Google Cloud and Worker configuration.
- [ ] Confirm the Neon URL uses the intended least-privileged application role and the numbered migrations/privileges are applied.
- [ ] Confirm no secret uses a browser-exposed `VITE_` prefix.

When a callback fails:

- [ ] Do not assume the previous error category is still current.
- [ ] Start one long-running tail before one fresh sign-in.
- [ ] Record only `action`, safe outcome, and `errorCategory`.
- [ ] Map the category to one stage and test that connector boundary with the real installed library.
- [ ] Make one evidence-backed change at a time.
- [ ] Test the complete deployed path before asking the user to retest.

Before declaring success:

- [ ] Local full checks pass.
- [ ] The intended immutable commit is the one deployed.
- [ ] Real allowed-account sign-in succeeds.
- [ ] Wrong-account denial is separately verified.
- [ ] Connected state survives reload.
- [ ] Stored OAuth material is inspected only through a safe plaintext-absence check.
- [ ] Logout/revocation and disposable calendar cleanup are verified.
- [ ] No secret or personal identifier appears in notes, logs, screenshots, commits, or chat.

## Safe diagnostic rule

For any future OAuth regression, start a long-running Wrangler Tail, perform one completely fresh real sign-in, and capture only the latest safe `errorCategory` for `action: auth.callback`. Diagnose that exact stage before changing code.

## Subsequent process setback

### Concurrent full test gates collided in the shared Windows worktree

- **Status:** Contained; clean rerun in progress.
- **What happened:** Two agents started the full Vitest gate at the same time in one shared worktree. A queue-deduplication suite encountered a temporary SSR cache atomic-rename error. The affected suite immediately passed by itself, so this was a test-runner filesystem collision rather than an application assertion failure.
- **Mistake:** The primary agent coordinated file ownership and commit order but did not assign exclusive ownership of the full test gate.
- **Impact:** One full check had to be repeated, consuming time and compute.
- **Correction:** Allow the active run to finish, then rerun the complete gate with no competing full test process.
- **Prevention:** Treat the full repository gate as a single-owner critical section. Before starting it, announce the owner; other agents may run only focused, non-overlapping suites until that owner releases the gate.
