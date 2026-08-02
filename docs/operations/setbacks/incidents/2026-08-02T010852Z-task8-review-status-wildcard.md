# Task 8 exact-tip review used a wildcard status prefix

- **Occurred:** 2026-08-02T01:08:52.9810474Z
- **Status:** closed
- **Last observed:** 2026-08-02T02:13:57.5367380Z
- **Recurrence resolved:** 2026-08-02T02:13:57.5367380Z
- **Phase:** Phase B Task 7 correlation repair publication exact-candidate review
- **Category:** read-only review diagnostic error

## What happened

The independent reviewer used a PowerShell `-like` pattern containing question marks to count untracked Git status rows. PowerShell treated those characters as wildcards, so the read-only inventory falsely classified all candidate rows as untracked.

## Impact

No file, provider, deployment, credential, key, protected value, or live state was read or changed by the faulty classification. The incorrect count was not accepted as review evidence, and the review was stopped before verdict.

## Corrective action

- Match the literal Git status prefix with `StartsWith` instead of wildcard syntax.
- Restart the exact-tip review from a newly frozen candidate.
- Treat any tracked setback-log edit as verdict-invalidating.

## Prevention

Use literal prefix methods for Git porcelain status codes; reserve wildcard matching for patterns that intentionally contain wildcard semantics.

## Recurrence history

- 2026-08-02T02:05:36.1140825Z: The same wildcard prefix was used during the
  final publication re-review and falsely counted all 94 staged paths as
  untracked. The reviewer recognized the diagnostic error, disclosed it before
  verdict, and reran with literal `StartsWith` semantics. No repository,
  remote, deployment, provider, calendar, credential, or key state changed.
  The review was stopped so the required ledger update could be included in a
  newly frozen candidate.
- 2026-08-02T02:06:05.1145797Z: A bounded local rerun using literal
  `StartsWith` semantics correctly reported zero untracked paths and all 94
  candidate paths staged. The documented correction is verified and the
  recurrence is closed.
- 2026-08-02T02:13:25.7536020Z: Independent review found one Minor ledger
  mismatch because the incident and index phase descriptions used different
  punctuation and word order. The correction must make the two descriptions
  byte-for-byte equal before review resumes.
- 2026-08-02T02:13:57.5367380Z: A bounded equality check proved the incident
  and index phase descriptions are identical, and documentation coverage
  passed. The correction is verified and the recurrence is closed.
