# SB-20260731-151505-task3-restore-bounds-docs-check: Restore bounds repair failed documentation coverage

- **Status:** closed
- **First observed:** 2026-07-31T15:15:05.0868995Z
- **Last observed:** 2026-07-31T15:30:50.5669463Z
- **Phase/task:** Phase B Task 3 restore-input bounds repair
- **Environment:** Shared worktree; documentation coverage gate
- **Version/commit:** 73191b7 plus unstaged TDD repairs and setback records

## Symptom

The bounded restore repair passes its reader, restore, combined, and TypeScript
checks, but documentation coverage exits nonzero with 11 captured lines.

## Impact

Restore repair cannot be accepted or proceed to security verification until
the missing/stale documentation categories are identified and corrected.

## Reproduction conditions

Run documentation coverage after adding fixed body, page, and total-candidate
bounds plus their new named production helpers.

## Safe evidence

Only the exit category and captured line count were reported. The content was
not rendered or retained. No source, URI, credential, protected identifier,
provider value, runtime stream, argument, environment value, or external
action occurred.

## Attempts and outcomes

- Reader tests pass 9/9.
- Restore tests pass 29/29.
- Combined tests pass 38/38.
- TypeScript reports zero diagnostics.
- Security and owned-diff verification paused after the docs failure.

## Cause classification

- **Confirmed cause:** Pending bounded documentation-category classification.
- **Hypotheses:** New named helper headings or exact reference anchors are
  missing.
- **Rejected hypotheses:** Restore runtime and type behavior are not red.
- **Known exclusions:** No provider or network action occurred.

## Correction and prevention

- **Correction:** Count missing/stale/helper-heading categories without
  rendering raw lines, then update only the owned restore references.
- **Prevention:** Add exact mirrored helper headings with new named production
  helpers before the first docs gate.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Safe category-only classification of the captured
  documentation result.

## Verification and related work

Restore-owned references cover all new helpers/constants, controller headings
are complete, and the canonical documentation gate passes independently and in
the full repository pipeline.

## Recurrence history

- 2026-07-31T15:15:05.0868995Z: First observed and contained before security
  verification.
- 2026-07-31T15:16:54.2798604Z: Adding the two privately classified bounded
  body-reader headings reduced captured docs output from 11 lines to 9, but the
  gate remains red. No line content was rendered. One further known-symbol
  classification may include newly named fixed-limit constants.
- 2026-07-31T15:17:49.5648226Z: Private symbol classification found zero
  remaining mentions of any restore-owned new helper or constant. All nine
  captured lines are other-category, so owned omissions are corrected and the
  global failure is attributed to the separately logged concurrent controller
  heading gap pending final combined verification.
- 2026-07-31T15:30:50.5669463Z: Closed after controller headings landed and the
  combined documentation/full repository gates passed.
