# SB-20260904-preview-build-branch-mismatch: Stale preview candidate omitted the Phase C runtime

- **Status:** contained
- **First observed:** 2026-08-29
- **Last observed:** 2026-09-04
- **Phase/task:** Phase C preview sign-in diagnostics and deployment
- **Environment:** Isolated preview; production is out of scope
- **Version/commit:** Phase C baseline 8ff6650; diagnostic source c80c8c1; stale candidates d4bfe97 and 913012e

## Symptom and impact

Preview deployment failed before the diagnostic could reach the live sign-in path.
Passing checks on the old source tree did not prove compatibility with the existing Phase C Worker.

## Reproduction conditions and safe evidence

- GitHub Actions run 33409920221 selected old main 913012e. The deployment command used the
  source config without building; Wrangler rejected the missing assets directory.
- Run 33259128489 selected diagnostic branch d4bfe97 and built successfully, but Cloudflare
  rejected the upload with Queue handler is missing (11001).
- That branch lacks the real queue and scheduled exports and the Phase C routes/configuration.
- Run 32327522245 deployed Phase C 8ff6650 successfully using the generated preview config.

## Attempts and outcomes

- Inspected the selected commits, failed jobs, source exports, and configuration before retrying.
- Created an isolated projects worktree; Phase C baseline auth tests: 19 passed.
- Imported the existing PR #3 tests. A context mismatch rejected the initial patch without
  changes; relocated the additions without replacing Phase C tests.
- Confirmed expected RED: six missing-diagnostic assertions failed; the other 17 passed.
- Integrated the existing diagnostic implementation while preserving Phase C recovery, audit
  categories, bound provider fetch, scope validation, queue/scheduled exports, and deploy workflow.
- Focused GREEN: 23 auth tests and both TypeScript checks passed.
- Dependency installation completed; transient registry metadata retries did not change the lockfile.

## Cause classification

- **Confirmed cause:** Deployment selected a stale application tree; its initial build invocation
  was also incomplete. Fixing the build alone exposed its missing queue handler.
- **Hypothesis:** The separate live sign-in failure may involve scopes or stored auth state;
  it is not diagnosed by these deployment errors.
- **Rejected hypothesis:** Removing the queue binding or using a no-op consumer is an acceptable fix.
- **Known exclusions:** No secrets, database roles, Google settings, or production deployments changed.

## Correction and prevention

- **Correction:** Port c80c8c1 onto the complete Phase C runtime; build and deploy the generated
  preview configuration from that exact verified commit.
- **Prevention:** Check commit ancestry and real Worker handlers before deployment; retain
  generated-config validation and test authentication contracts, not just compilation.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Complete release checks, deploy preview, then inspect the safe live stage.
- Keep the diagnostic until successful preview sign-in is confirmed. Never record callback URLs.

## Verification and related work

- Full local release check passed: 1,905 unit tests (six skipped), 199 contract tests,
  149 Worker tests, both typechecks, documentation coverage, build, and release security scan.
- Browser tests: 47 passed after installing the missing locked Chromium test runtime.
- Explicit preview build, generated-config validation, and Wrangler dry run passed. The generated
  artifact contains the real queue/R2 bindings and the two permanent schedules.
- Live deployment and real sign-in remain pending. Phase C live acceptance is not complete.
