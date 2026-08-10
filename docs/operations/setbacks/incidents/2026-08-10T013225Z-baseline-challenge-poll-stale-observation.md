# SB-20260810-013225-baseline-challenge-poll-stale-observation: Initial poll observed the previous challenge during fresh-run startup

- **Status:** contained
- **First observed:** 2026-08-10T01:32:25.2533710Z
- **Last observed:** 2026-08-10T01:32:25.2533710Z
- **Phase/task:** Phase B monitored candidate deployment, fresh baseline checkpoint
- **Environment:** Windows direct-controller status poll
- **Version/commit:** Current Phase B checkout

## Symptom

The first status poll saw the existing baseline challenge file while the newly
launched controller was still starting. Its challenge timestamp belonged to the
previous run, even though the new controller process was already present.

## Impact

No evidence was submitted and no provider action was based on the stale file.
The run was rechecked by comparing the challenge file timestamp and issued time
with the new controller start time; the controller then produced a fresh
nonce-bound challenge.

## Cause classification

- **Confirmed cause:** A filesystem race between process launch and challenge-file replacement.
- **Rejected hypotheses:** Controller failure, provider failure, stale-evidence acceptance, or deployment mutation.

## Correction and prevention

- **Correction:** Require `challenge.LastWriteTimeUtc > active.startedAtUtc` and verify the challenge `issuedAt` is from the same run before asking for owner evidence.
- **Prevention:** Never treat mere file existence as a fresh challenge; compare run identity/time and nonce-bound evidence.
- **Owner:** Codex.

## Verification

The follow-up poll observed a fresh baseline challenge issued after the new run
start, with a present nonce and an active controller process. No stale evidence
was reused and no secret or provider payload was exposed.

## Recurrence history

- 2026-08-10T01:32:25.2533710Z: First observed and contained during the fresh
  monitored retry.
