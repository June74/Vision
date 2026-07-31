# SB-20260731-153609-task3-review-package-path-count: Final review package exceeded the frozen path inventory by two

- **Status:** closed
- **First observed:** 2026-07-31T15:36:09.4455727Z
- **Last observed:** 2026-07-31T15:38:08.1408943Z
- **Phase/task:** Phase B Task 3 second final package re-review
- **Environment:** Main Phase B worktree; generated ignored review artifact
- **Version/commit:** 38496c5

## Symptom

The regenerated sanitized package contains 77 diff headers while the Task 3
report still declares a frozen 75-path implementation/report inventory.

## Impact

The package cannot be distributed until the two-path delta is identified,
classified as aligned or unexpected, and reflected exactly in the report.

## Reproduction conditions

Generate the full base-to-tip package after the review-driven restore bounds
repair modifies paths that may not have appeared in the earlier diff-derived
inventory.

## Safe evidence

Only aggregate path, setback-header, URI, email, sensitive-assignment, and
redaction counts were emitted. No package content, URI, credential, protected
identifier, provider value, runtime stream, or environment value was displayed.

## Attempts and outcomes

- Package privacy scan passes with zero unsafe values.
- Setback-file diff headers remain zero.
- Reviewer distribution stopped before handoff.

## Cause classification

- **Confirmed cause:** The new package path set and report inventory differ by
  two; exact path classification is pending.
- **Hypotheses:** The review-driven restore repair touched two previously
  unchanged but required paths.
- **Rejected hypotheses:** No setback path entered the package.
- **Known exclusions:** No source, Git, provider, or external state changed
  during package generation.

## Correction and prevention

- **Correction:** Compare old and new sanitized header sets, validate the exact
  new paths against the review finding/repair allowlist, then update the report
  inventory and regenerate.
- **Prevention:** Recompute the exact package inventory after every
  review-driven repair that can bring previously unchanged files into scope.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Emit only the two safe path names and inventory
  membership categories.

## Verification and related work

The two paths are the simple and technical references for the restore job,
both required by the accepted bounded-restore review repair. The report now
contains an exact 77-path inventory with zero missing, extra, or duplicate
entries compared with the sanitized package.

## Recurrence history

- 2026-07-31T15:36:09.4455727Z: First observed and contained before reviewer
  distribution.
- 2026-07-31T15:38:08.1408943Z: Closed after classifying both aligned paths,
  updating the committed report, and proving exact 77-to-77 set equality.
