# SB-20260729-200750-guessed-sync-repository-path

- **Status:** closed
- **Last observed:** 2026-09-04
- **Phase/task:** Phase B consolidated final-fix implementation
- **Title:** Source inspection used a guessed sync repository path
- **Impact:** Three read-only commands used nonexistent guessed paths; the latest also attempted a range read after the missing file returned no content. No source or external state changed.
- **Cause:** The inspections assumed repository, validator, and test directory locations instead of resolving their tracked paths first.
- **Resolution:** Resolved each live path through `git ls-files`; all remaining reads must use tracked paths already returned by Git.
- **Recurrence:** Recurred twice after the original observation.

## 2026-09-04 recurrence

A read-only search included nonexistent `sync-commit-repository.ts`. The existing
`sync-repository.ts` still returned the relevant matches. File discovery confirmed
the repository and integration test paths; the next source read succeeded. No
source or external state changed. Continue using discovered filenames.

During the conflict follow-up, another read assumed a repository-local setback
script and a token-test filename. Discovery located the script in the skill
directory and the actual `auth-token-concurrency.test.ts` file. A separate range
read supplied a word rather than an integer to `Select-Object -First`; the corrected
numeric read succeeded. These were local inspection mistakes only, with no
application changes or external requests. Use discovered paths and numeric ranges.
