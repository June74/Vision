# SB-20260818-175012-phase-c-application-checks-r2-cleanup: Phase C application-check failures

- **Status:** contained
- **First observed:** 2026-08-18T17:50:12Z
- **Last observed:** 2026-08-18T17:54:45Z
- **Phase/task:** Phase C application-check CI diagnosis
- **Environment:** CI unit suite reported by the project owner; local diagnosis on the Phase C write-pipeline worktree
- **Version/commit:** `8e76e0a8374cfe6f2bb5de737a39f169cbdfabd8`

## Symptom and impact

The unit suite reported two failures: the R2 deletion-capability test exceeded
its five-second test timeout, and the temporary-surface cleanup test's
classified documentation list omitted
`docs/operations/phase-c-live-acceptance.md`. The application-check job exited
nonzero. No provider, database, calendar, deployment, or object-deletion
mutation occurred.

## Cause classification

- **Confirmed cause:** `docs/operations/phase-c-live-acceptance.md` was added
  in commit `a81d900` after the frozen cleanup classification was established.
  The file is present and tracked in the current checkout, but it is absent
  from the retained-permanent cleanup classification, so the classification
  list and the actual top-level operations documents disagree.
- **Confirmed cause:** The R2 test collects the whole production source surface
  and builds an in-memory TypeScript program before scanning. The focused test
  passes with a 15-second timeout, while the hosted unit run exceeded the
  default five-second Vitest test budget under suite load.
- **Hypotheses:** None remain for the two supplied failures.
- **Rejected hypothesis:** A Node 20 deprecation warning alone does not explain
  the cleanup-list assertion; that assertion compares repository-derived paths.
- **Known exclusions:** Dependency installation completed before the failing
  application-check step; no provider or database mutation is indicated.

## Correction and prevention

- **Correction:** Add the Phase C acceptance record to the reviewed retained
  permanent inventory and update its frozen manifest evidence; give the
  whole-repository R2 contract a justified bounded timeout or reduce its scan
  work, then rerun the focused and complete unit gates.
- **Prevention:** Keep the R2 scan scope bounded and keep active-operations
  documentation inventory expectations synchronized with the retained files.
- **Owner:** Phase C controller.
- **Next diagnostic step:** Apply the two corrections separately under
  test-first review, then verify the focused tests and the complete
  application-check chain.

## Verification and related work

Both corrections are applied and locally verified, so this is contained rather
than closed: the failure was observed in a hosted run, and only local gates have
been rerun here. A green hosted application-check run closes it.

- Cleanup inventory: `docs/operations/phase-c-live-acceptance.md` is classified
  `retain_permanent` in commit `4acc384`, alongside a `--refresh-digests` mode
  that recomputes the five frozen fingerprints a reviewed change moves.
- R2 contract: the whole-repository test carries a named 15s budget rather than
  a bare number. Scan-scope reduction was measured before being rejected —
  pruning to the import closure of every capability-owning file still retains
  93 of 172 files and 72% of the scanned bytes, because the largest sources
  legitimately own or reach deletion capability, so it saves roughly 0.2s of a
  1.1s scan while narrowing a security boundary. The timeout is justified by
  measurement, not raised to make a failure disappear: the test costs 1.1s cold
  in a bare process, 2.3s under Vitest in isolation, and 3.2s inside the full
  unit suite on an idle developer machine, which is 65% of the default 5s
  budget before any CI contention.
- The applied budget was mutation-checked: reducing it to 1ms fails the test
  with `Test timed out in 1ms`, proving the argument is wired rather than
  silently ignored.
- Local evidence: focused suite 51/51, full unit suite 1,879 passed and 6
  skipped across 119 files, and the complete `pnpm check` chain green.
