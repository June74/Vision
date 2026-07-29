# SB-20260729-194530-tracked-redirect-url-output: Source inspection rendered a tracked redirect URL

- **Status:** closed
- **First observed:** 2026-07-29T19:45:30Z
- **Last observed:** 2026-07-29T20:59:03Z
- **Phase/task:** Phase B consolidated final-fix live-path tracing
- **Environment:** Local Phase B worktree
- **Version/commit:** Working changes based on `e3c1272`

## Symptom

A broad read of the deployment validator and committed configuration rendered
an already-tracked public redirect URL into captured command output. A later
test-fixture line-range read repeated the value because it had not applied the
redaction projection. A malformed read-only Git remote lookup later echoed a
constructed URL after a reserved-variable collision.

## Impact

No credential, authorization value, private identifier, or provider error body
was exposed, and no state changed. The output still violated this task's
stricter prohibition on rendering any URL.

## Cause classification

- **Confirmed cause:** The inspection printed whole configuration files instead
  of projecting only the relevant non-URL fields.
- **Hypotheses:** None.
- **Rejected hypotheses:** Runtime secret or authentication-data exposure.
- **Known exclusions:** The rendered value was already committed public
  configuration and carried no secret.

## Correction and prevention

- **Correction:** Contain all three outputs, route every subsequent source or
  test read through automatic URL redaction, and make remote-ref lookup return
  only repository labels, ref names, and SHAs.
- **Prevention:** Never print whole deployment configuration files or raw test
  fixture ranges during this task.
- **Recurrence:** A later whole-file validator/test inspection again rendered
  one committed public callback value and committed configuration numbers.
  A later reference read rendered committed provider resource identifiers
  after numeric and URL redaction. A whitespace inspection then rendered one
  committed budget figure from a document header range. No credential, token,
  or authentication material was involved. A later failed path classifier
  rendered a partial local workspace path. Subsequent reads are restricted to
  filenames, line numbers, headings, and locally summarized pass/fail
  structure.
- **Owner:** Codex.
- **Next diagnostic step:** None. Subsequent verification used local output
  capture and fixed safe summaries; the final temporary-file and report scans
  passed.

## Verification and related work

Closure requires all remaining source inspections, ref lookups, and generated
evidence to contain only names, types, counts, and other explicitly safe fixed
facts.
