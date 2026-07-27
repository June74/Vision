# SB-20260727-040624-task3-security-scope-omitted: Task 3 plan omitted required security-boundary files

- **Status:** closed
- **First observed:** 2026-07-27T04:06:24Z
- **Last observed:** 2026-07-27T04:06:24Z
- **Phase/task:** Phase B restore Task 3
- **Environment:** Local Phase B worktree
- **Version/commit:** `1d6ad12`

## Symptom

The Task 3 acceptance text required Worker-bundle value scanning and exact
runtime-field classification, but its file list omitted the release scanner
and client-binding boundary that implement those guarantees.

## Impact

The implementer stopped before candidate edits. The pre-edit security test
also exposed the expected classification gap for the two temporary fields.
No provider, secret, key, deployment, or runtime state changed.

## Reproduction conditions

Compare the Task 3 bundle requirement with the current release-scan targets
and exhaustive runtime-binding classification test.

## Safe evidence

The current scanner checks protected values only in client assets and release
evidence. The Worker bundle is not a protected-value target, and the two
temporary runtime fields are absent from the exhaustive runtime denylist.

## Attempts and outcomes

- The implementer reported `NEEDS_CONTEXT` before editing.
- Bounded inspection confirmed both required production boundaries.
- The plan now names the scanner, client-binding source, mirrored references,
  and exact value-only Worker scan behavior.

## Cause classification

- **Confirmed cause:** The plan's Step 5 requirement was broader than its
  mapped file list and test detail.
- **Hypotheses:** None.
- **Rejected hypotheses:** Test-only fixture assertions would not prove the
  built Worker value boundary.
- **Known exclusions:** Server-side binding names remain allowed in the Worker
  bundle; only protected values are rejected there.

## Correction and prevention

- **Correction:** Extend the scanner with a required protected-value-only
  Worker target and classify both temporary fields through the runtime
  client-forbidden boundary.
- **Prevention:** Trace every bundle acceptance statement to the production
  scanner target and exhaustive classification source before freezing a plan.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

Task 3 must demonstrate RED/GREEN fixtures for Worker protected values,
missing Worker output, allowed server-only binding names, and exact runtime
classification.

## Recurrence history

- 2026-07-27T04:06:24Z: First observed and contained before candidate edits.
