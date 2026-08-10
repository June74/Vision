# SB-20260802-165619-reconnect-plan-pnpm-ci-clean-install: Reconnect plan invoked pnpm clean-install instead of the repository CI script

- **Status:** closed
- **First observed:** 2026-08-02T16:56:19.252219Z
- **Last observed:** 2026-08-02T17:04:00.3746920Z
- **Phase/task:** Phase B reconnect-recovery execution preflight
- **Environment:** Local Phase B linked worktree on Windows and pnpm 11.9.0
- **Version/commit:** `ebb37b9`

## Symptom

The bounded baseline command entered pnpm clean-install and began removing dependency links instead of running the package.json ci script.

## Impact

The run was terminated; local node_modules dependency links require restoration. No source, database, provider, credential, deployment, calendar, key, or backup state changed.

## Reproduction conditions

Run `pnpm.cmd ci` in a repository that defines a package script named `ci`.
pnpm resolves the bare command to its built-in `ci` command, whose documented
aliases are clean-install, `ic`, and install-clean, instead of invoking the
package script.

## Safe evidence

The bounded command eventually reported only `Removing node_modules` before
termination. `pnpm.cmd help ci` identified the command as clean-install. After
containment, `node_modules` still existed with six cache/store entries but its
normal dependency links were absent. No private value was read or retained.

## Attempts and outcomes

- The baseline invocation was terminated after an unplanned approximately
  9-hour-45-minute wait with no test output.
- A read-only package-manager help check confirmed that bare `pnpm ci` is a
  built-in clean-install command.
- Dependency restoration and corrected baseline verification are pending.
- Offline frozen-lockfile restoration reached the locked package set but
  stopped because one public dependency tarball was absent from the local
  store; it downloaded nothing.

## Cause classification

- **Confirmed cause:** The plan and baseline invocation used `pnpm.cmd ci`
  instead of `pnpm.cmd run ci`; pnpm command precedence selected its built-in
  destructive clean-install operation.
- **Hypotheses:** None recorded.
- **Rejected hypotheses:** The repository `ci` script did not begin and then
  hang in a test; it never ran.
- **Known exclusions:** No tracked source, index, commit, database, provider,
  credential, deployment, calendar, object, key, or backup state changed.

## Correction and prevention

- **Correction:** Restore dependencies from the local pnpm store, replace every
  execution-plan occurrence with `pnpm.cmd run ci`, and rerun the full baseline
  through that explicit package-script boundary.
- **Prevention:** Use `pnpm run <script>` whenever a package-script name can
  collide with a pnpm built-in, and classify the resolved command with
  `pnpm help <name>` during plan review when uncertain.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; all future aggregate gates use the explicit
  package-script form `pnpm.cmd run ci`.

## Verification and related work

Frozen-lockfile restoration completed without changing the lockfile. The plan
correction was committed separately, documentation coverage and the exact diff
check passed, and `pnpm.cmd run ci` exited zero with 1,730 unit and integration
tests plus one intentional skip, 179 contract tests, 110 Worker tests, 36
browser tests, typecheck, documentation, both production builds, and release
security passing. Focused elevated Worker and build reruns then passed without
the sandbox-only warnings. Keep this incident and its index row unstaged.

## Recurrence history

- 2026-08-02T16:56:19.252219Z: First observed.
- 2026-08-02T16:57:21.7822950Z: Offline restoration failed closed because one
  locked public package tarball was not cached; no network download occurred.
- 2026-08-02T17:04:00.3746920Z: Closed after frozen dependency restoration,
  the explicit-script plan correction, a green complete repository baseline,
  and warning-free focused Worker/build reruns.
