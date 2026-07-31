# SB-20260731-050329-task3-ledger-close-patch-context: Task 3 ledger closure used a stale timestamp context

- **Status:** closed
- **First observed:** 2026-07-31T05:03:29.3393807Z
- **Last observed:** 2026-07-31T05:23:56.8935134Z
- **Phase/task:** Phase B Task 3 canonical verification evidence
- **Environment:** Main Phase B worktree
- **Version/commit:** 5f11f52 plus verified test-timeout correction

## Symptom

The combined incident-closure patch expected a last-observed timestamp that did
not match the current ledger file, so the patch failed.

## Impact

Closure evidence was delayed. The patch failed atomically; no incident status,
source file, Git state, or external state changed.

## Reproduction conditions

Apply a multi-file closure patch using a timestamp inferred from a later
recurrence entry rather than rereading the file header.

## Safe evidence

The patch tool returned a context mismatch. No protected value, URI, provider
data, or external action was involved.

## Attempts and outcomes

- The combined closure patch made no changes.
- Canonical verification remains green and recorded separately.

## Cause classification

- **Confirmed cause:** One expected header timestamp was stale.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** No write or verification failure occurred.
- **Known exclusions:** No partial patch, provider action, or external mutation
  occurred.

## Correction and prevention

- **Correction:** Read only the exact status, timestamp, and next-step fields,
  then apply smaller current-context patches.
- **Prevention:** Re-read headers before multi-file ledger state transitions.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

After bounded header inspection, the two incident records were closed with
their exact current contexts.

## Recurrence history

- 2026-07-31T05:03:29.3393807Z: First observed and contained with no change.
- 2026-07-31T05:04:29.8116594Z: Closed after smaller exact-context patches
  updated both verified incident records.
- 2026-07-31T05:22:16.2872162Z: Reopened as contained after a later incident
  update assumed stale multiline next-step text and failed atomically. No
  ledger, package, source, or external state changed.
- 2026-07-31T05:22:59.4392973Z: A smaller combined patch then used stale index
  row wording and also failed atomically. Incident-file and index updates must
  now be applied separately from exact current context.
- 2026-07-31T05:23:56.8935134Z: Closed after the incident file and exact
  current index row were updated successfully as separate patches.
