# SB-20260807-182155-baseline-evidence-validation-write-failed: Fresh baseline evidence validation/write failed before provider dispatch

- **Status:** closed
- **First observed:** 2026-08-07T18:21:55.969122Z
- **Last observed:** 2026-08-07T18:26:53Z
- **Phase/task:** Phase B live acceptance and release closure
- **Environment:** Windows PowerShell, linked Phase B worktree
- **Version/commit:** Current reviewed Phase B checkout; no tracked implementation change

## Symptom

The approved run reached the fresh baseline confirmation checkpoint, but the first local nonce-bound evidence validation/write attempt returned a safe failure category before the controller could consume the evidence.

## Impact

No provider, deployment, rollback, schedule, binding, secret, key, database, calendar, or private-data state changed; the approved controller remains contained at its checkpoint.

## Reproduction conditions

The first local validator incorrectly required the challenge's `notBefore`
timestamp to be at or after its issuance time. The controller intentionally
allows an older lower-bound for the baseline checkpoint; the challenge schema,
nonce, active-version hash, and freshness were otherwise valid.

## Safe evidence

The safe diagnostic showed a parseable fresh baseline challenge, valid schema,
label, nonce shape, active-version hash shape, two expected cron entries, and
an age within the controller's 600-second evidence window. No challenge value
was printed or copied into this record.

## Attempts and outcomes

1. The first evidence write returned `baseline_evidence_write_failed` before
   touching provider state because of the over-strict local time-order check.
2. A bounded diagnostic isolated that check as the only false predicate.
3. The validator was corrected to follow the controller contract: require
   evidence to be fresh and no earlier than the issued challenge, without
   requiring `notBefore` to follow issuance for the baseline label.

## Cause classification

- **Confirmed cause:** Local evidence preparation imposed an invalid
  `notBefore >= issuedAt` assumption that is not part of the controller's
  baseline contract.
- **Hypotheses:** None recorded.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** None recorded.

## Correction and prevention

- **Correction:** Removed the over-strict predicate from the one-shot local
  evidence preparation and retained the controller's exact nonce, hash,
  freshness, source, and cron-shape checks.
- **Prevention:** Reuse the controller contract as the source of truth for
  baseline evidence validation; never infer an ordering rule from the field
  name alone.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Establish the smallest safe reproduction.

## Verification and related work

The corrected nonce-bound baseline evidence write completed with a safe
allowlisted result: challenge validation passed, evidence was written, and
the expected cron count was two. The approved controller remained the only
process authorized to continue; no provider mutation or rollback occurred.

## Recurrence history

- 2026-08-07T18:21:55.969122Z: First observed.
