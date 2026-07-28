# SB-20260727-014937-verification-command-discovery-mistakes: Verification commands were guessed or searched too broadly

- **Status:** closed
- **First observed:** 2026-07-27T01:47:00Z
- **Last observed:** 2026-07-28T19:21:34Z
- **Phase/task:** Phase B acceptance instrumentation Task 1 review-package verification
- **Environment:** Local worktree
- **Version/commit:** `50569e6`

## Symptom

The documentation check was first invoked with the reversed script name
`check:docs`, the setback helper was assumed to exist under `scripts/`, and a
recursive search entered dependencies and encountered a missing transient
directory.

## Impact

Verification handoff was delayed. No source, provider, credential, key, or
deployment state changed, and no private value was exposed.

## Reproduction conditions and safe evidence

- `package.json` defines `docs:check`, not `check:docs`.
- The repository does not contain `scripts/new_setback.py`.
- An unbounded recursive file search entered `node_modules`.

## Cause classification

- **Confirmed cause:** Commands and helper locations were assumed before
  inspecting the repository, and the fallback search was not bounded to
  repository-owned paths.
- **Hypotheses:** None.
- **Rejected hypotheses:** The documentation validator itself did not fail; it
  had not yet been invoked with its actual repository script name.
- **Known exclusions:** No repository mutation occurred before this incident
  record.

## Attempts and outcomes

1. `check:docs` failed because the script name does not exist.
2. The documented setback helper path failed because the helper is absent.
3. The recursive helper search produced a dependency traversal error.

## Correction and prevention

- **Correction:** Read `package.json`, use `docs:check`, and create this incident
  through the repository's established Markdown format.
- **Prevention:** Discover package scripts before invoking them; check a
  documented helper with a direct path test; exclude dependency directories
  from repository searches.
- **Owner:** Codex.
- **Next diagnostic step:** None.

## Verification and related work

At 2026-07-27T01:50Z, the repository's `docs:check` script and
`git diff --check` both passed.

## Recurrence history

- 2026-07-28T14:00:00Z: A credential-path documentation search included the
  guessed filename `docs/operations/backup-restore.md`; the repository uses
  `docs/operations/backup-and-restore.md`. The read-only search stopped with no
  provider, source, or private-data change. Discovering the directory contents
  supplied the exact path before retry.
- 2026-07-28T14:07:00Z: A combined ignored-report gate used a brittle exact
  heading match and an unsupported Git exclude-file path. The first run made no
  acceptance claim. Exact safe-field checks and a supported null path replaced
  both assumptions; no provider or tracked-source state changed.
- 2026-07-28T15:11:28Z: The acceptance-design self-review counted only list
  items ending in semicolons, so the correctly period-terminated final scenario
  was omitted and six values were reported as five. The spec itself was
  unchanged; the verifier is rerun with both valid terminators accepted.
- 2026-07-28T15:12:05Z: The next self-review used a contiguous substring for
  a sentence that wraps across a Markdown line break, so the provider-simulation
  distinction was incorrectly reported absent. The spec already contained the
  requirement; a whitespace-tolerant expression replaces the brittle check.
- 2026-07-28T15:13:03Z: The first whitespace-tolerant retry placed the flexible
  boundary between the wrong words and again reported false. A direct
  cross-line expression using the actual line break location returned exactly
  one match; no spec content or external state changed during either check.
- 2026-07-28T19:21:34Z: The Task 1 review-package verifier required headings
  to end immediately before a line feed and therefore reported zero sections
  for a valid Windows CRLF file. Direct inspection confirmed the sections; a
  carriage-return-tolerant expression verifies the package before review.
