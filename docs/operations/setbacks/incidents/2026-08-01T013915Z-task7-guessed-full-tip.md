# Setback SB-20260801-013915-task7-guessed-full-tip

- **Status:** closed
- **Detected:** 2026-08-01T01:39:15.9331440Z
- **Scope:** Phase B Task 7 final exact-tip review package

## What happened

The controller expanded the abbreviated candidate commit by assumption instead
of resolving the full object name from Git. Native Git rejected the invalid
revision range and the package writer left one 150-byte ignored header-only
artifact.

## Impact

The final review dispatch was delayed. The partial ignored artifact is not
admissible review evidence. No tracked file, Git index, HEAD, remote, provider,
deployment, or key state changed before this incident record.

## Cause classification

- **Confirmed cause:** The full candidate SHA was guessed from abbreviated
  commit output rather than obtained with `git rev-parse HEAD`.
- **Rejected hypothesis:** The branch tip was missing; Git resolved the actual
  full tip successfully.

## Correction and prevention

- **Correction:** Delete only the exact partial ignored package and regenerate
  from the authoritative full SHA.
- **Prevention:** Never synthesize or expand commit IDs; resolve every exact
  object directly from Git immediately before package, review, push, or deploy.
- **Owner:** Codex.
- **Verification:** The replacement package was generated from `git rev-parse`
  results in the same command, spans 55,123 lines, is ignored, and names the
  exact resolved candidate range.
