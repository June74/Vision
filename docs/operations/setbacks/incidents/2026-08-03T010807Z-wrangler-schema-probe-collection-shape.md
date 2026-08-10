# SB-20260803-010807-wrangler-schema-probe-collection-shape: Wrangler schema probe parsed the deployment collection incorrectly

- **Status:** closed
- **First observed:** 2026-08-03T01:08:07.0776764Z
- **Last observed:** 2026-08-03T01:11:49.6361294Z
- **Phase/task:** Phase B corrected redeployment correlation repair
- **Environment:** Local read-only Wrangler metadata probe
- **Version/commit:** Candidate `c1911f8`; live preview still on rollback

## Symptom

The metadata-only probe attempted to sort a malformed PowerShell collection and
returned `active_shape_failed` without reaching the version schema inspection.

## Impact

The read-only correlation investigation paused. No deployment or provider state
mutation occurred, and no provider identifier or value was emitted.

## Reproduction conditions

Capture Wrangler deployment JSON into an array and combine `-join`, pipeline,
and array-subexpression syntax without first parenthesizing JSON decoding.

## Safe evidence

Only local PowerShell parse and shape errors were emitted. Wrangler stderr and
its disposable debug log were suppressed and deleted.

## Attempts and outcomes

- The first read-only schema probe failed before selecting an active version.
- The retry will decode the joined JSON in an explicit expression and only then
  wrap the decoded result as an array.

## Cause classification

- **Confirmed cause:** Ambiguous collection/pipeline grouping produced the
  wrong runtime shape for sorting.
- **Known exclusions:** No secret, URL, account identifier, version identifier,
  or raw provider response was printed.

## Correction and prevention

- **Correction:** Parenthesize JSON decoding before array normalization.
- **Prevention:** Separate native-output joining, JSON decoding, and array
  normalization into individually named steps.
- **Owner:** Codex.
- **Next diagnostic step:** Retry with explicit grouping and boolean/schema-name
  output only.

## Verification and related work

The explicitly grouped retry succeeded and emitted only property names. It
confirmed version annotations are available; the installed Wrangler source
also confirmed `workers/tag` and `workers/message` are the fields populated by
the deploy options. No identifier or value was emitted.

## Recurrence history

- 2026-08-03T01:08:07.0776764Z: First observed and contained without mutation.
- 2026-08-03T01:11:49.6361294Z: Corrected probe succeeded with schema-name-only
  output; incident closed.
