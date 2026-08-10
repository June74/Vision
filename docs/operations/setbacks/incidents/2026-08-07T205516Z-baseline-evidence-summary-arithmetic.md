# SB-20260807-205516-baseline-evidence-summary-arithmetic: Evidence summary wrapper arithmetic

- **Status:** closed
- **First observed:** 2026-08-07T20:55:16Z
- **Last observed:** 2026-08-07T20:55:16Z
- **Phase/task:** Phase B classifier-fingerprinted monitored candidate deployment
- **Environment:** Windows PowerShell, linked Phase B worktree
- **Version/commit:** Current reviewed Phase B checkout; no tracked implementation change

## Symptom

The local baseline-evidence writer validated the fresh challenge and wrote the
nonce-bound evidence file, but its final reporting expression attempted to
subtract two `DateTimeOffset` values directly. This PowerShell version rejected
that overload before the safe summary was printed.

## Impact

No provider request or schedule change occurred. The evidence write completed;
only the local summary command failed after the write.

## Resolution

The evidence file will be checked through explicit timestamp conversion and
bounded field validation, without direct `DateTimeOffset` subtraction.

## Prevention

Convert timestamps to a common UTC `DateTime` or use an explicit elapsed-time
calculation before formatting safe evidence summaries.
