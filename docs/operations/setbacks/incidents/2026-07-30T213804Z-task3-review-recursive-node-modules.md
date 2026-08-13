# SB-20260730-213804-task3-review-recursive-node-modules: Task 3 reviewer recursively entered broken package links

- **Status:** contained
- **First observed:** 2026-07-30T21:38:04.779421Z
- **Last observed:** 2026-08-13T00:32:26Z
- **Phase/task:** Phase B live-acceptance closure Tasks 3-4 read-only review
- **Environment:** Read-only review/preflight agent sandbox
- **Version/commit:** `38bed3e991d5bfb40b1452bd955634e30247c045`

## Symptom

A read-only recursive discovery command entered node_modules and returned DirectoryNotFound errors for broken package links before substantive review.

A later Task 4 preflight scout also timed out while broadly locating instruction
and constraint files from the worktree root.

## Impact

One specification review pass stopped and must be restarted with exact artifact paths; no file, provider, private-data, or external state changed.

## Reproduction conditions

Use recursive filesystem discovery from the project root even though the exact
review artifact paths were supplied.

## Safe evidence

The command reached broken package links under `node_modules` and stopped before
substantive review. It returned only top-level artifact names and byte lengths.

## Attempts and outcomes

- The first specification reviewer stopped at discovery.
- The validated package and every required document remain available at their
  exact supplied paths.
- The Task 4 scout stopped immediately after the read-only timeout; it made no
  file, Git, provider, network, or environment-value changes.

## Cause classification

- **Confirmed cause:** Unnecessary recursive discovery traversed dependency
  links outside the exact review scope.
- **Hypotheses:** None.
- **Rejected hypotheses:** No required artifact is missing.
- **Known exclusions:** No Git, provider, live, remote, file mutation, private
  value, URL, identifier, log, argument, or stream was involved.

## Correction and prevention

- **Correction:** Restart the review using only literal artifact paths and no
  directory enumeration.
- **Prevention:** Exact-path review tasks must prohibit root-recursive
  discovery and dependency traversal.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Resume the Task 4 scout using only supplied literal
  document paths and explicitly bounded source/test directories.

## Verification and related work

The replacement Task 3 specification reviewer used supplied exact paths and
completed its review. Task 4 recurrence verification remains pending.

## Recurrence history

- 2026-07-30T21:38:04.779421Z: First observed.
- 2026-07-31T03:15:37.1332096Z: A Task 4 preflight scout repeated the
  unbounded-discovery pattern and hit a read-only timeout before substantive
  inspection; it stopped without changing state.
- 2026-08-13T00:32:26Z: A root-recursive PowerShell instruction-file scan
  traversed generated and dependency trees and produced an oversized path
  dump before substantive review; it made no file, Git, provider, or private
  value changes. Subsequent inspections are restricted to literal paths and
  shallow known directories.
