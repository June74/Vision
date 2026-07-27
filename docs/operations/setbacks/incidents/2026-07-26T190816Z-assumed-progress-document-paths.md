# SB-20260726-190816-assumed-progress-document-paths: Repository paths were assumed

- **Status:** closed
- **First observed:** 2026-07-26T19:08:16.577518Z
- **Last observed:** 2026-07-27T02:10:30Z
- **Phase/task:** Phase B completion audit
- **Environment:** Local Phase B worktree
- **Version/commit:** `1dff60e`

## Symptom

A read-only progress search included two guessed filenames that are not present even though the repository listing contained the authoritative names.

## Impact

No file changed; the completion audit paused until searches were restricted to listed files.

## Reproduction conditions

Search guessed singular progress and live-acceptance filenames instead of using
the names returned by the immediately preceding directory listing.

## Safe evidence

The authoritative listing contains `phase-b-progress-simple.md`,
`phase-b-progress-technical.md`, and the numbered recovery/release plan.

## Attempts and outcomes

- The guessed-file search failed safely.
- The listed filenames were then opened successfully.

## Cause classification

- **Confirmed cause:** The search command ignored the authoritative filenames
  it had just obtained.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** The progress documents were present and unchanged.

## Correction and prevention

- **Correction:** Used only filenames returned by the repository listing.
- **Prevention:** Resolve a file from actual directory output before adding it
  to a multi-file read.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

Both progress records and the numbered recovery/release plan were found and
read.

## Recurrence history

- 2026-07-26T19:08:16.577518Z: First observed.
- 2026-07-26T19:38:30.4251990Z: Recurred when the recovery/release plan
  omitted its numbered `06` prefix. Contained by listing the directory and
  selecting the exact returned filename before the next read.
- 2026-07-26T19:51:33.9920088Z: Recurred after `health.ts` was listed but a
  guessed longer filename was requested. The failed read made no change; the
  exact listed filename is used next.
- 2026-07-26T20:15:53.4340700Z: Recurred when a conventional `drizzle/`
  directory was assumed. The repository root was then listed and the actual
  `migrations/` directory selected.
- 2026-07-26T20:23:31.7153689Z: Recurred when a guessed AI-usage integration
  filename was included and Vitest silently ignored it. The directory was
  listed and `budgeted-provider.test.ts` selected explicitly.
- 2026-07-26T20:41:44.0266068Z: Recurred when two conventional alternate
  Vitest configuration paths were read without first listing them. The
  confirmed root `vitest.config.ts` supplied the needed project definition.
- 2026-07-27T01:55:34Z: Recurred when two API source filenames were inferred
  from route concepts instead of discovered from the directory. Both reads
  failed without changing state; the directory was listed and the exact
  `*-routes.ts` filenames are used next.
- 2026-07-27T02:10:30Z: Recurred when restore test filenames were inferred
  from production modules before listing the backup-test directory. The failed
  read changed nothing; the returned `neon-adapter.test.ts` and
  `restore-command.test.ts` paths were opened successfully.
