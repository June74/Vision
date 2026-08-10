# SB-20260802-193219-reconnect-final-ci-result-expired: Final reconnect CI result expired before retrieval

- **Status:** closed
- **First observed:** 2026-08-02T19:32:19.212184Z
- **Last observed:** 2026-08-02T19:39:03.9294984Z
- **Phase/task:** Phase B OAuth reconnect recovery Task 4 final candidate verification
- **Environment:** Local Codex Windows execution host
- **Version/commit:** `c1911f82c0fb274e3d50d20c3cbe82ba2abceb51`

## Symptom

The completed background command cell was no longer available when its authoritative exit status was requested.

## Impact

The prior full CI run cannot be counted as final evidence and must be repeated with durable safe result capture.

## Reproduction conditions

Run the complete repository CI command in a yielded background command cell,
then attempt to retrieve its final status after that cell is no longer retained
by the execution host.

## Safe evidence

The safe wait result was `exec cell 836 not found`. No CI output, provider
output, credentials, or private data are retained in this record.

## Attempts and outcomes

- The first status retrieval found that the background cell no longer existed,
  so the run was excluded from final evidence.
- The candidate remained unchanged at the exact reviewed commit while a fresh
  full CI run was prepared.
- The repeat gate exited zero and its durable result confirmed the same exact
  candidate commit.

## Cause classification

- **Confirmed cause:** The execution host no longer retained the yielded cell,
  so its authoritative completion status could not be retrieved.
- **Hypotheses:** The command may have completed before the cell expired, but
  that is deliberately not treated as evidence.
- **Rejected hypotheses:** No application, test, database, or provider failure
  is established by the missing-cell result.
- **Known exclusions:** No source, deployment, database, calendar, credential,
  or provider state was changed by the failed status retrieval.

## Correction and prevention

- **Correction:** Repeat the complete repository CI gate from the unchanged
  candidate and retain a small privacy-safe status artifact outside streamed
  command output.
- **Prevention:** Long final gates must write only their exit status and safe
  aggregate counts to a durable ignored artifact before their command cell may
  expire.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Run the fresh gate and verify the durable safe
  result artifact.

## Verification and related work

Closed after the fresh complete gate passed at the recorded candidate: 1,756
unit/integration assertions passed with six intentional skips, 183 contract
assertions passed, 116 Worker assertions passed, 36 browser tests passed, and
the typecheck, documentation, builds, and release security checks completed in
the zero exit. The ignored durable result records the exact candidate, zero
exit, and `ci_passed=true`; the unavailable earlier run remains excluded.

## Recurrence history

- 2026-08-02T19:32:19.212184Z: First observed.
- 2026-08-02T19:39:03.9294984Z: Closed after the unchanged candidate passed a
  fresh complete gate with a durable privacy-safe result artifact.
