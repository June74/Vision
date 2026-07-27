# SB-20260727-015932-safe-workflow-watch-window-expired: Safe workflow outlived the local watch window

- **Status:** closed
- **First observed:** 2026-07-27T01:59:00Z
- **Last observed:** 2026-07-27T01:59:32Z
- **Phase/task:** Phase B privacy-safe scheduled acceptance
- **Environment:** Guarded preview workflow
- **Version/commit:** `a2bbc80`

## Symptom

The local workflow-watch command reached its 60-second tool limit before the
guarded safe-tail workflow completed.

## Impact

The wait command exited nonzero, but the remote workflow continued. No
deployment, configuration, credential, key, or application state changed.

## Reproduction conditions and safe evidence

The workflow has a bounded multi-minute tail step while the local watch window
was only 60 seconds. A read-only status query reported the safe-tail job still
in progress and every deployment or configuration job skipped.

## Cause classification

- **Confirmed cause:** The local wait window was shorter than the workflow's
  allowed duration.
- **Hypotheses:** None.
- **Rejected hypotheses:** The workflow itself had not failed at the time of
  the timeout.
- **Known exclusions:** No provider log text, identifier, URL, secret, token,
  key, or protected content is recorded here.

## Attempts and outcomes

1. The blocking watch exceeded 60 seconds.
2. A fixed-shape status query confirmed continued execution without mutation
   jobs.

## Correction and prevention

- **Correction:** Poll fixed-shape status in short bounded calls.
- **Prevention:** Do not use a local watch timeout shorter than the workflow's
  configured duration.
- **Owner:** Codex.
- **Next diagnostic step:** None.

## Verification and related work

The guarded workflow completed successfully. Every deployment and
configuration job was skipped, and the allowlisted output was
`no_scheduled_event`. The local timeout was therefore only a wait-window
problem.
