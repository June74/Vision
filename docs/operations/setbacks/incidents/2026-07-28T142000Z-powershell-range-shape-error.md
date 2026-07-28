# SB-20260728-142000-powershell-range-shape-error: PowerShell source range had the wrong shape

- **Status:** closed
- **First observed:** 2026-07-28T14:20:00Z
- **Last observed:** 2026-07-28T14:20:00Z
- **Phase/task:** CI secret-handoff architecture audit
- **Environment:** Local Windows worktree
- **Version/commit:** `386b7d3`

## Symptom

A read-only source-excerpt helper passed an invalid range shape to PowerShell
after the required workflow evidence had already been read safely.

## Impact

The architecture report was delayed. No source, provider, credential, secret,
database, R2, deployment, restore, or key state changed.

## Reproduction conditions and safe evidence

Invoke the excerpt helper with the unsupported range construction. PowerShell
rejects the helper while earlier exact evidence remains available.

## Cause classification

- **Confirmed cause:** The helper used an invalid PowerShell range shape.
- **Hypotheses:** None.
- **Rejected hypotheses:** Missing source evidence; the necessary exact lines
  had already been read.
- **Known exclusions:** No private value was emitted.

## Attempts and outcomes

1. The range helper failed.
2. A simpler exact-line read supplied the remaining safe evidence.

## Correction and prevention

- **Correction:** Use exact-line reads or a simple integer range supported by
  the installed PowerShell version.
- **Prevention:** Avoid compound range helpers for small source excerpts.
- **Owner:** Codex.
- **Next diagnostic step:** None.

## Verification and related work

The CI handoff report completed with the required repository and provider
boundary findings.
