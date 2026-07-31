# SB-20260731-152211-task3-controller-diff-line-ending-warnings: Controller diff counter treated normalization advisories as issues

- **Status:** closed
- **First observed:** 2026-07-31T15:22:11.0697118Z
- **Last observed:** 2026-07-31T16:39:42.5185006Z
- **Phase/task:** Phase B Task 3 final controller review repair
- **Environment:** Windows Git owned-diff verification
- **Version/commit:** 73191b7 plus unstaged GREEN repairs and setback records

## Symptom

The owned diff audit surfaced four Windows line-ending normalization advisories,
and its aggregate counter treated them as diff-check issues.

## Impact

The controller lane paused despite 53 passing tests, zero TypeScript and docs
violations, zero conflict markers, and zero sensitive-pattern findings.

## Reproduction conditions

Count every Git diagnostic line as a diff issue instead of using the
`git diff --check` exit status to distinguish normalization advisories from
whitespace errors.

## Safe evidence

Only aggregate warning, conflict-marker, and sensitive-pattern counts were
reported. No file content, URI, credential, protected identifier, provider
value, runtime stream, argument, or environment value was emitted.

## Attempts and outcomes

- Controller tests pass 53/53.
- TypeScript and documentation coverage report zero violations.
- The advisory class matches the already accepted Windows restore-lane
  normalization behavior.

## Cause classification

- **Confirmed cause:** The audit classifier conflated advisory output with
  nonzero diff-check status.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** No conflict marker, sensitive pattern, or known
  whitespace error exists.
- **Known exclusions:** No provider, network, Git index, or external mutation
  occurred.

## Correction and prevention

- **Correction:** Accept only the warning-suppressed exit-code audit as the
  whitespace result; do not normalize content merely to silence Windows Git.
- **Prevention:** Classify normalization advisories separately from diff-check
  violations.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Confirm zero exit from the owned diff check, then
  hand off the controller repair.

## Verification and related work

The incident is closed as a non-blocking environment warning; final owned
exit-code confirmation remains part of the controller handoff.

## Recurrence history

- 2026-07-31T15:22:11.0697118Z: Observed, classified as non-blocking, and
  closed without formatting churn.
- 2026-07-31T16:16:40.0494899Z: Recurred during the second-wave workflow
  repair's owned-path audit. The diff check exited successfully across the ten
  owned paths; only expected Windows normalization advisories appeared. The
  lane avoids further content-printing diff calls and keeps the incident
  closed as non-blocking.
- 2026-07-31T16:39:42.5185006Z: Recurred during the root exact-scope audit for
  all 19 implementation paths. The implementation set had zero missing and
  zero extra paths, the output-suppressed diff check exited successfully, and
  no formatting churn was applied.
