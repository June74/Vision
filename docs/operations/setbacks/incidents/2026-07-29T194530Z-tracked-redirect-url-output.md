# SB-20260729-194530-tracked-redirect-url-output: Source inspection rendered a tracked redirect URL

- **Status:** closed
- **First observed:** 2026-07-29T19:45:30Z
- **Last observed:** 2026-07-30T03:40:11.7346777Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final re-review
- **Environment:** Local Phase B worktree
- **Version/commit:** Working changes based on `41d3e74`; `d24e24d`
- **Latest recurrence:** A read-only sync/AI procedure audit rendered
  checked-in public endpoint literals in one source excerpt before switching to
  value-redacted output. It exposed no credential, personal data, provider
  identifier, or live state and made no mutation.

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

## Recurrence history

- 2026-07-29T22:05:35.1087778Z: A bounded configuration projection included
  one already-tracked deployment callback value because the projection was
  serialized before URL redaction. No credential, authorization data, private
  content, or provider mutation was involved. Subsequent configuration reads
  are limited to names, counts, and redacted summaries.
- 2026-07-29T22:06:36.3770325Z: The successful package-manager dependency
  update printed its own public update-notice link. It was unrelated to the
  repository or any provider account and exposed no protected data. Future
  package-manager output is captured and summarized without rendering links.
- 2026-07-29T22:24:07.3408553Z: A bounded workflow range read still included
  already-tracked public endpoint literals. No credential, authorization
  value, provider-private data, or state change was involved. Further workflow
  inspection is restricted to redacted projections or exact static assertions.
- 2026-07-29T22:31:49.4391296Z: A focused static-workflow test failure rendered
  its whole tracked received string, including already-committed public
  endpoint literals. No credential, authorization value, external response, or
  state change was involved. Remaining static assertions are corrected before
  rerun so failure output stays bounded.
- 2026-07-29T22:46:45.9890985Z: A short production-fixture range read rendered
  committed policy and threshold numbers while deriving the exact closed
  production contract. No credential, provider-private data, or state change
  was involved. Subsequent verification emits only pass/fail counts.
- 2026-07-30T00:16:54.4369723Z: A whole-branch review helper rendered one
  already-committed public redirect literal during a bounded source trace.
  It stopped immediately; no credential, authorization-bearing value,
  provider-private data, or repository/provider mutation was involved.
- 2026-07-30T03:07:03.8217300Z: A read-only preflight audit broadly read the
  deployment-config validator and rendered one tracked public redirect value
  plus non-secret configuration values. Inspection stopped immediately. No
  credential, provider identifier, user identifier, network call, repository
  mutation, or provider mutation was involved. The audit issued no readiness
  verdict and will not resume with raw source output.
