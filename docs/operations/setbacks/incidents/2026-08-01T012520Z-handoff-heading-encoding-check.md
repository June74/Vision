# Setback SB-20260801-012520-handoff-heading-encoding-check

- **Status:** closed
- **Detected:** 2026-08-01T01:25:20.7299518Z
- **Scope:** Claude Code Phase B handoff acceptance

## What happened

The first handoff acceptance check read a UTF-8 Markdown file through Windows
PowerShell's default text encoding and reported that five headings containing
em dashes were absent. The file existed and the ASCII headings matched.

## Impact

The handoff was not delivered until its cross-reader compatibility was
corrected. No project implementation, Git index, provider, deployment, or key
state changed.

## Cause classification

- **Confirmed cause:** The validation reader and file used different default
  encoding assumptions for non-ASCII punctuation.
- **Rejected hypothesis:** Required handoff sections were actually omitted.

## Correction and prevention

- **Correction:** Use ASCII hyphens in handoff headings and validate the final
  file with explicit UTF-8 decoding.
- **Prevention:** Prefer ASCII control headings in cross-tool handoff prompts.
- **Owner:** Codex.
- **Verification:** Every required heading matches under explicit UTF-8 and
  default Windows text reads.
