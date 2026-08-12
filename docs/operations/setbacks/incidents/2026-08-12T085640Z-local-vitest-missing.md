# SB-20260812-085640 — Local targeted test runner unavailable

- **Status:** contained
- **Detected:** 2026-08-12T08:56:40Z
- **Area:** Phase B maintenance observer contract verification
- **Symptom:** The targeted `pnpm exec vitest` invocation could not resolve the local Vitest executable in this worktree.
- **Impact:** No files, provider state, or external systems were changed; local verification was delayed.
- **Correction:** Use the repository's installed dependency setup or the same locked CI installation path, then rerun the focused contract tests before accepting the maintenance retry.

