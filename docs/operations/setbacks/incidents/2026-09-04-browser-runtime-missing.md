# SB-20260904-browser-runtime-missing: Locked Chromium test runtime not installed locally

- **Status:** closed
- **First/last observed:** 2026-09-04
- **Phase/task:** Phase C preview integration verification
- **Environment:** New isolated Windows worktree, Playwright 1.61.1
- **Version/commit:** Integration based on 8ff6650

## Symptom, impact, and reproduction

The first browser suite could not launch Chromium: the required headless executable was absent.
Forty-six tests failed at launch and one non-browser test passed; these were not application
assertion failures. Reproduce on a host lacking Playwright's locked browser revision.

## Safe evidence and attempts

Playwright reported Executable does not exist for Chromium headless shell revision 1228.
Installed the dependency's Chromium runtime, then reran the unchanged complete browser suite:
47 passed in 11.5 seconds.

## Cause classification

- **Confirmed cause:** Missing local browser binary after installing the JavaScript dependencies.
- **Hypotheses/rejected hypotheses:** No evidence of an application regression from this run.
- **Known exclusions:** No live provider or application data was used by these browser tests.

## Correction and prevention

- **Correction:** Installed Chromium with the project's locked Playwright executable.
- **Prevention:** Install the pinned browser before first browser verification on a new host;
  the GitHub verification job already does this.
- **Owner:** Codex.
- **Next diagnostic step:** None for this local setup incident; live deployment is separate.

## Verification and related work

`pnpm test:e2e`: 47 passed, exit 0. No source change was needed for this incident.
