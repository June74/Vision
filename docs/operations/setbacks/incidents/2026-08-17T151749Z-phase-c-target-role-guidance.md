# SB-20260817-151749-phase-c-target-role-guidance: Disposable target guidance conflated owner SQL access with application-role acceptance

- **Status:** contained
- **First observed:** 2026-08-17T15:17:49Z
- **Last observed:** 2026-08-17T15:17:49Z
- **Phase/task:** Phase C live/private-pilot target handoff
- **Environment:** Neon SQL Editor and the Codex project terminal
- **Version/commit:** `a81d900`

## Symptom

The user supplied a disposable branch and database. The SQL Editor reported an
owner role, and the migration table was not visible. The Codex command process
also did not inherit `DATABASE_URL`, `PREVIEW_RESTORE_DATABASE_URL`, or
`PREVIEW_RESTORE_TARGET_ID`.

## Impact

Live acceptance stopped before any migration, deployment, database row change,
calendar provider mutation, or cleanup action. No secret value was placed in
chat or repository files.

## Reproduction conditions

Connect to the disposable branch in Neon SQL Editor, inspect the current role
and migration relation, then run the Codex command from a process that does not
inherit the operator's separately configured environment.

## Safe evidence

- The user reported an owner role and no visible migration-table result.
- `src/server/env.ts` requires the application runtime URL to authenticate as
  `vision_app`.
- `docs/operations/backup-and-restore.md` requires a disposable preview branch,
  migration-9 starting shape, and a least-privileged `vision_app` restore URL.
- The current Codex process reported all three target environment variables as
  missing.
- No live write, deployment, migration, secret read, or provider mutation ran.

## Cause classification

- **Confirmed cause:** Earlier guidance treated the SQL Editor's owner role as
  sufficient proof of the application runtime role and did not verify that the
  database URL was set in the same process used by Codex.
- **Hypotheses:** The disposable branch may be empty or may have a migration
  baseline that is not visible through the reported SQL result. The connection
  string may also be pooled rather than direct.
- **Rejected hypotheses:** None yet. The branch's migration baseline and direct
  application-role connection remain unverified.

## Correction and prevention

- Use the owner role only for disposable-target setup and read-only inspection.
- Require a direct, non-pooled connection for migration and acceptance checks.
- Verify the app URL's username is `vision_app` without printing the URL.
- Run the migration-table query before choosing a migration range. Apply the
  reviewed chain from the target's actual baseline; do not assume `0009`.
- Confirm the environment variables are visible in the same Codex terminal
  process before running a migration or deployment command.

- **Owner:** Codex and project owner.
- **Next diagnostic step:** In the same Codex terminal, set the disposable
  direct connection privately, run the read-only identity and migration-table
  query, and report only the non-secret result.

## Verification and related work

The correction is not closed yet. The live acceptance record remains pending
until target identity, migration baseline, direct `vision_app` access, and the
temporary cleanup boundary are independently verified.
