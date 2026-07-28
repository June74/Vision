# SB-20260727-014937-verification-command-discovery-mistakes: Verification commands were guessed or searched too broadly

- **Status:** closed
- **First observed:** 2026-07-27T01:47:00Z
- **Last observed:** 2026-07-28T22:31:58.1347046Z
- **Phase/task:** Phase B acceptance instrumentation Task 3 test design
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
- 2026-07-28T19:37:57Z: The Task 2 brief verifier assumed the heading ended
  after the task number and expected global threshold values inside a
  task-only extraction. Direct inspection confirmed the correct section. The
  ignored brief receives an explicit binding-values preface and is verified
  against the actual full heading.
- 2026-07-28T20:44:57.5288369Z: A repository file-list filter supplied one
  literal composite string where an explicit PowerShell pattern array was
  intended, so the read-only discovery returned no matches. The retry uses an
  explicit array and changes no project or provider state.
- 2026-07-28T21:12:25.3539371Z: A documentation inspection command assumed
  temporary role-probe reference filenames before listing their directories.
  The read-only command reported only missing paths; directory discovery
  supplied the actual names before retry, with no product-data or provider
  access.
- 2026-07-28T21:13:02.0639099Z: A follow-up read-only command assumed
  `scripts/check-docs.ts`; the discovered validator is
  `scripts/validate-doc-coverage.ts`. The retry uses the observed path and no
  project behavior or external state changed.
- 2026-07-28T21:20:01.8709129Z: A read-only self-review search included a
  nonexistent optional Task 1 specification filename. The binding plan search
  remained valid; listing the SDD directory supplied the available filenames,
  and no project or provider state changed.
- 2026-07-28T21:20:45.5557364Z: The provider-revision self-review guessed a
  schema filename before discovering the tracked path. The failed read was
  local and read-only. The review is constrained to paths returned by
  `git ls-files` before finalization.
- 2026-07-28T21:48:52.1911717Z: The Task 3 re-review artifact verifier split
  on the prose word `Important` instead of anchoring the Markdown heading, then
  a timestamp helper reused the unsupported `Get-Date -AsUTC` flag. Both
  commands were local and read-only, exposed no private data, and changed no
  product state. The corrected verifier anchors `^## Important$`, and UTC
  timestamps use `[DateTime]::UtcNow`.
- 2026-07-28T22:29:38.3038924Z: An inline `tsx` attestation validator lost
  string quotes across the PowerShell-to-CMD boundary and failed during
  parsing. No attestation values were printed and no file or external state
  changed. The retry uses native PowerShell object validation and safe summary
  output.
- 2026-07-28T22:31:00.8488530Z: A harmless nested-shell return-shape probe
  constructed an invalid PowerShell string and stopped at parsing. It
  contained no attestation data and changed no state. The retry uses a fixed
  literal command before any closed-data patch orchestration.
- 2026-07-28T22:31:58.1347046Z: The first closed patch orchestration did not
  recognize the nested shell response wrapper and stopped before applying any
  edit. No manifest value was emitted and the attestation remained unchanged.
  The retry inspects only response keys and types before parsing internally.
