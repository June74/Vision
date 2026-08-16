# SB-20260816-151133 — Phase C Worker rerun config mismatch

- **Status:** closed
- **Detected:** 2026-08-16T15:11:33.4084464Z
- **Area:** Phase C verification
- **Symptom:** A manual Worker-suite rerun used `vitest.worker.config.ts`,
  which is not a repository file. Vitest exited before loading any tests.
- **Impact:** No application, provider, deployment, credential, database, or
  source state changed. This was a command/setup error only.
- **Correction:** Read `package.json` and use the repository script
  `test:worker`, which selects the configured `worker` project from
  `vitest.config.ts`.

## Evidence

- Incorrect command: `.\\node_modules\\.bin\\vitest.cmd --config vitest.worker.config.ts run`
- Result: exit 1 before test discovery; no test assertion ran.
- Repository contract: `package.json` defines `test:worker` as
  `vitest run --project worker`.

## Containment

The failed command was stopped immediately. The repository-configured command
`.\\node_modules\\.bin\\vitest.cmd run --project worker` was then run
successfully: 7 files and 116 tests passed. The environment warnings observed
by that successful rerun are tracked separately in the existing contained
Wrangler sandbox incidents.
