# SB-20260807-205640-candidate-log-suffix-probe: Redacted log reader suffix probe

- **Status:** closed
- **First observed:** 2026-08-07T20:56:40Z
- **Last observed:** 2026-08-07T20:56:40Z
- **Phase/task:** Phase B classifier-fingerprinted monitored candidate deployment
- **Environment:** Windows PowerShell, linked Phase B worktree
- **Version/commit:** Current reviewed Phase B checkout; no tracked implementation change

## Symptom

The first safe result reader derived the sibling stderr filename with a generic
extension replacement, which produced a non-existent suffix and reported an
unknown stderr length.

## Impact

The controller result was decoded correctly and no provider request was
repeated. Only the local redacted verification field was temporarily
inconclusive.

## Resolution

The reader now replaces the explicit `.stdout.log` suffix with `.stderr.log`
and rechecks the same completed run.

## Prevention

Use explicit multi-suffix replacement for paired bounded log files and treat an
unexpected sibling path as a verification error rather than silently accepting
an absent file.
