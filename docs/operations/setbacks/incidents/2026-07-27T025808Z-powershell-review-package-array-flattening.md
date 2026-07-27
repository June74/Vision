# SB-20260727-025808-powershell-review-package-array-flattening: PowerShell review package did not flatten command output

- **Status:** closed
- **First observed:** 2026-07-27T02:58:08Z
- **Last observed:** 2026-07-27T19:57:34Z
- **Phase/task:** Phase B restore Task 1 review
- **Environment:** Local ignored scratch workspace
- **Version/commit:** `3e2f60d`

## Symptom

The first non-Bash review-package fallback serialized two command-output
arrays as type names and joined section markers onto one line.

## Impact

The invalid ignored package was rejected by its own section-count check and
was not dispatched. No tracked file, implementation, provider state, or
private value changed.

## Reproduction conditions

Construct the entire package as one nested PowerShell array and cast it to a
string array before command-output elements have been flattened.

## Safe evidence

The package was only 186 bytes and contained zero recognized section markers.

## Attempts and outcomes

- The first package failed size and section validation.
- Regeneration uses explicit line-list appends for each section and command
  result.

## Cause classification

- **Confirmed cause:** Nested command-output arrays were stringified instead
  of appended element by element.
- **Hypotheses:** None.
- **Rejected hypotheses:** The Git base and head both resolved and the task
  contains one commit.
- **Known exclusions:** No diff was exposed or sent to a reviewer.

## Correction and prevention

- **Correction:** Build a typed list of strings and append each Git command's
  output lines explicitly.
- **Prevention:** Require exactly three section markers, one commit, and a
  nontrivial byte size before every review dispatch.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The regenerated package must contain the commits, files-changed, and diff
sections and cover the exact Task 1 range.

## Recurrence history

- 2026-07-27T02:58:08Z: First observed and contained before dispatch.
- 2026-07-27T19:57:34Z: Recurred while reducing a successful deployment log
  to two closed booleans. PowerShell `-match` returned matching line arrays;
  no log lines were printed. The retry joins the lines in memory before
  comparison.
