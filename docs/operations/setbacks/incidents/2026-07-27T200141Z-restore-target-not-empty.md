# SB-20260727-200141-restore-target-not-empty: Restore retry reported target not empty

- **Status:** contained
- **First observed:** 2026-07-27T20:01:41Z
- **Last observed:** 2026-07-27T20:01:41Z
- **Phase/task:** Phase B restore Task 4 safe-tail
- **Environment:** Preview Worker and disposable Neon restore target
- **Version/commit:** reviewed candidate `7ef941b`

## Symptom

The restore-only safe-tail workflow completed successfully as an observer, but
its single allowlisted restore record reported outcome `failed` with category
`restore_target_not_empty`.

## Impact

No restore success is accepted. The disposable branch must remain retained and
must not be deleted. The temporary restore Worker and secrets require
fail-closed rollback before further diagnosis.

## Cause classification

- **Confirmed stage:** Restore target precondition rejected a non-empty
  authoritative target.
- **Confirmed timing condition:** The temporary Worker deploy step completed
  127 seconds before the restore-only tail step started. With the one-minute
  restore schedule, at least two scheduled boundaries could occur before the
  observer attached.
- **Strongly supported causal inference:** A scheduled restore ran during that
  unobserved window and populated the target, after which the observed retry
  correctly rejected the now non-empty target. This is supported by the target
  being verified empty immediately before deployment and later containing one
  atomically promoted backup snapshot.
- **Alternative hypothesis:** Some other operation populated authoritative
  rows after the last successful emptiness attestation.
- **Known exclusions:** The evidence is not `no_scheduled_event`, is not a log
  framing ambiguity, and does not prove that any earlier unobserved restore
  succeeded.

## Correction and prevention

- **Immediate containment:** Redeploy the previously verified normal two-cron
  Worker, delete both temporary restore secrets, and retain the disposable
  branch.
- **Diagnosis:** After rollback, inspect only closed target counts and restore
  evidence state to determine whether the target contains a complete,
  reference-valid restored dataset.
- **Prevention candidate:** Attach the safe-tail listener before activating a
  one-shot restore schedule, or make the one-shot result durably queryable so a
  successful first event cannot be missed.

## Verification and related work

Fail-closed containment completed:

- the exact previously verified normal ref was redeployed successfully;
- the deployed tree was confirmed to be that exact normal ref;
- the dashboard showed the normal 15-minute and daily schedules and no
  one-minute temporary schedule;
- the public health endpoint returned HTTP 200 with the exact expected
  two-field healthy response;
- both temporary restore secrets were permanently deleted and verified absent;
- the disposable Neon branch remains retained;
- a private read-only aggregate query found 51 authoritative rows across 13
  tables, zero event rows, all 29 tables present, and a valid target
  attestation.

The target was positively verified empty immediately before the temporary
deployment. The restore importer promotes all authoritative tables in one
serializable transaction after staging reference and row-count validation.
Therefore the target change is consistent with one committed import before the
safe-tail listener attached, followed by the captured non-overwrite failure.
The 127-second measured observation gap makes that event ordering the supported
explanation. The required explicit success record was still missed, so a final
retry design must attach observation before activation or durably retain the
first result.
