# Recovery Conflict Diagnostic Implementation Plan

> **For agentic workers:** Use test-driven-development for the coupled code/test change and requesting-code-review before release. Inline execution keeps this small dependent change together; the reviewer is independent.

**Goal:** Distinguish an explicit recovery conflict from execution failure without changing admission rules.

**Architecture:** Reuse the existing closed diagnostic enum and `AuthStageError` wrapper at the callback outcome check. Keep the repository, logger schema structure, and response gate unchanged.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers, Vitest, GitHub Actions.

Hard line: **no more than 20 agents at once**. Reuse the existing isolated
`phase-c-oauth-preview-fix` worktree under Projects, not the stale OneDrive checkout.
The owner has approved implementation, testing, and preview deployment.

## Task 1: RED and minimal GREEN

Files: `tests/worker/auth.test.ts`, `src/server/auth/diagnostics.ts`,
`src/server/auth/oauth-routes.ts`, `tests/unit/server/logging.test.ts`.

- [x] Run the unchanged focused baseline (23 auth and 31 logging tests passed):

```powershell
pnpm.cmd test:worker tests/worker/auth.test.ts
pnpm.cmd test:unit tests/unit/server/logging.test.ts
```

- [x] Expand the existing recovery failure test table across local, preview, and
  production. Use the existing real Worker app and encrypted in-memory stores;
  control only the recovery port. Explicit conflict expects the new constant;
  throws and invalid return values expect the existing constant. Assert actual
  body, header, logs, no Set-Cookie, no redirect, no new session, and no old-session
  revocation. Scan the actual outputs for existing private fixture sentinels.
  The core new assertion for the preview conflict is:

```ts
expect(response.headers.get("x-vision-auth-diagnostic")).toBe(
  "callback_authorization_recovery_conflict",
);
```

- [x] Run the focused Worker suite and observe the missing-category failure (3 expected failures, 42 passed);
  execution-failure cases must retain their previous behavior.
- [x] Add the literal `"callback_authorization_recovery_conflict"` to
  `AUTH_DIAGNOSTIC_STAGES`. Import `AuthStageError` into the route and insert only
  this branch immediately after the awaited recovery call, before its existing
  accepted-outcome guard:

```ts
if (recoveryOutcome === "conflict") {
  throw new AuthStageError("callback_authorization_recovery_conflict");
}
```

- [x] Run focused Worker/logging suites and typecheck (45 auth and 32 logging tests passed). The existing enum-driven
  logging tests must admit the new literal and reject arbitrary strings. Existing
  accepted-outcome/ordering tests remain intact.

## Task 2: Documentation and review

Files: `docs/operations/google-oauth-setup.md`, both
`docs/reference/{simple,technical}/src/server/auth/diagnostics.md` references,
and the existing callback recovery incident/index.

- [x] Add the new runbook row and clarify that the old code no longer means an
  explicitly returned conflict on this release. Document that neither code
  reveals the precise failed SQL predicate or raw database error.
- [x] Update both references without introducing named production helpers.
- [x] Independently review the complete diff against the approved spec. Resolve
  critical/important findings and verify the repository SQL is unchanged.
  Review found no critical/important issues; its minor historical-status wording
  note was corrected in the incident's current local-verification section.

## Task 3: Verification and exact preview release

- [x] Run `pnpm.cmd check`, then `pnpm.cmd test:e2e`; require exit zero. Both passed: 2,344 passing tests, 6 existing skips.
- [x] Build with `CLOUDFLARE_ENV=preview`, validate with
  `pnpm.cmd deploy:check:preview`, restore the prior environment override, then
  run `wrangler.cmd deploy --dry-run --config dist/vision/wrangler.json --name vision-preview`.
- [ ] Run `git diff --check`, stage only reviewed source/tests/docs, commit,
  and fast-forward push `HEAD:refs/heads/codex/phase-c-write-pipeline`.
- [ ] Dispatch `preview.yml` on that branch using operation `none`, budget
  configuration `false`, the full reviewed commit, and the existing parser's
  validated canonical v2 acceptance context. Use Node crypto for correlation and
  JSON stdin to GitHub CLI; do not print the context or redispatch blindly.
- [ ] Verify admission, candidate verification, and normal preview deployment
  success for that exact SHA; record run ID and Worker version only.
- [ ] Check live root/health and unauthenticated session without logging cookies
  or redirect query values. Ask the owner to start one fresh sign-in from the
  preview root and return only its diagnostic category. Do not claim auth fixed.
