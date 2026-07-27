# SB-20260726-190637-unbounded-backup-code-inspection: Backup source inspection was too broad

- **Status:** closed
- **First observed:** 2026-07-26T19:06:37.768763Z
- **Last observed:** 2026-07-27T03:08:11.5689988Z
- **Phase/task:** Phase B restore Task 1 fix wave
- **Environment:** Local Phase B worktree
- **Version/commit:** `1dff60e`

## Symptom

A read-only backup search returned far more local source text than needed because full files and recursive matches were combined.

## Impact

No private value or provider data was exposed, but the output was noisy and delayed focused live-acceptance work.

## Reproduction conditions

Combine complete-file reads with recursive search output, or rely on PowerShell's
default table formatting for long file paths and lines.

## Safe evidence

The first command emitted large source sections. Two follow-up searches were
also broader than necessary or truncated useful line details. No credential,
database value, provider account metadata, or private application record was
included.

## Attempts and outcomes

- Full backup sources and recursive matches produced excessive output.
- A narrower search still used default table formatting and hid the useful
  line details.
- Reading complete progress and plan documents together again produced
  excessive output.
- Subsequent checks used exact filenames, exact incident IDs, and explicit
  line rendering.

## Cause classification

- **Confirmed cause:** Inspection scope and output formatting were not bounded
  independently before execution.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No secret or provider-private data was emitted.

## Correction and prevention

- **Correction:** Switched to exact files, exact patterns, explicit line
  rendering, and small result caps.
- **Prevention:** Do not combine raw full-file reads with recursive searches;
  cap matches and render only the required fields.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The follow-up incident lookup returned only the two requested files and two
exact index rows.

## Recurrence history

- 2026-07-26T19:06:37.768763Z: First observed.
- 2026-07-26T19:08:56.5870529Z: Recurred in two completion-document
  inspections; output scope was then corrected and verified.
- 2026-07-27T03:08:11.5689988Z: A recursive instruction-file lookup used a
  broad include pattern and returned many repository paths. No dependency
  contents, provider data, or private values were emitted; subsequent reads
  returned to exact paths and bounded line ranges.
