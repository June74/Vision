# SB-20260727-002225-full-check-shell-timeout: Full check exceeded the shell time limit

- **Status:** closed
- **First observed:** 2026-07-27T00:22:25Z
- **Last observed:** 2026-07-28T14:41:10Z
- **Phase/task:** Phase B completion resume verification
- **Environment:** Local Windows PowerShell
- **Version/commit:** working tree after `ac1f044`

## Symptom

The combined repository check exceeded the command's two-minute limit while
the Worker test project was starting.

## Impact

TypeScript, 622 unit tests, and 179 contract tests passed, but the Worker,
documentation, build, and security stages did not produce final acceptance
evidence from that invocation.

## Reproduction conditions

Run every repository check sequentially under a 120-second shell deadline.

## Safe evidence

The command reported its timeout only after the completed TypeScript, unit, and
contract stages.

## Attempts and outcomes

- The combined check timed out.
- Remaining suites are split into bounded commands so every stage can produce
  a distinct exit result.

## Cause classification

- **Confirmed cause:** The combined suite duration exceeded the command
  deadline.
- **Hypotheses:** None.
- **Rejected hypotheses:** The completed unit and contract suites did not fail.
- **Known exclusions:** No provider state changed.

## Correction and prevention

- **Correction:** Run Worker, documentation, build, and security checks as
  separate bounded commands.
- **Prevention:** Use segmented acceptance commands for this repository's
  current test volume.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Capture each remaining stage exit independently.

## Verification and related work

The segmented checks passed: 75 Worker assertions, documentation coverage,
production build, and security scan. The earlier TypeScript, 622 unit, and 179
contract stages had already passed.

## Recurrence history

- 2026-07-27T00:22:25Z: First observed and contained.
- 2026-07-27T00:24:17Z: Closed after every remaining check passed separately.
- 2026-07-28T14:41:10Z: Recurred because the controller mistakenly assigned
  a one-second timeout to the complete `pnpm check` command. The shell stopped
  the command during its opening TypeScript stage; no file or provider state
  changed. The same gate is rerun with a duration appropriate to the recorded
  suite size.
