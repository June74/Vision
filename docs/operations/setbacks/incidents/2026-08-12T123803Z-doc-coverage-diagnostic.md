# SB-20260812-123803 — Diagnostic helpers initially missed reference headings

- **Status:** contained
- **Detected:** 2026-08-12T12:38:03Z
- **Last observed:** 2026-08-12T18:20:31Z
- **Area:** Phase B CI tail-supervisor diagnosis
- **Evidence:** Documentation coverage correctly rejected the two new production helpers because each lacked the required simple and technical reference headings.
- **Impact:** No provider, deployment, credential, database, or key state changed; the diagnostic code was not published from this state.
- **Resolution:** Added the required reference sections and described the fixed, opt-in, privacy-safe diagnostic channel.
- **Prevention:** Run documentation coverage immediately after adding or renaming any production helper.

## Recurrence - 2026-08-12

The new `detail` lifecycle helper from `568b36b` was missing its JSDoc and
simple/technical reference headings. `pnpm.cmd docs:check` reported exactly
those three safe violations; no provider or runtime state changed. The helper
comment and both reference sections were added, then the documentation check
was rerun.
