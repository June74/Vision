# SB-20260803-193735-snapshot-diff-crlf-warning-fatal: Snapshot diff packaging treated a CRLF warning as fatal

- **Status:** closed
- **First observed:** 2026-08-03T19:37:35.791353Z
- **Last observed:** 2026-08-06T22:44:32.7354035Z
- **Phase/task:** Phase B TSX adapter independent review
- **Environment:** Local Windows Git review packaging
- **Version/commit:** Review artifact only; no provider mutation

## Symptom

The first owner-approved no-index snapshot diff emitted a Git LF-to-CRLF warning on the copied baseline; PowerShell ErrorActionPreference Stop converted the warning into a terminating error before the review package was written.

## Impact

The implementation files and baseline snapshot are unchanged; independent review is delayed until the diff is rerun with command-local line-ending conversion disabled.

## Reproduction conditions

Run the scoped Git comparison with command-local line-ending handling and
isolate known warning output from the exit-status assertion.

## Safe evidence

Only a known LF-to-CRLF warning category was retained; no raw diff or private
value was emitted.

## Attempts and outcomes

- The first wrapper stopped on the warning.
- A corrected bounded review package was produced with the native fallback.

## Cause classification

- **Confirmed cause:** Terminating PowerShell handling treated a Git line-ending
  warning as a failed review command.
- **Hypotheses:** None.
- **Rejected hypotheses:** The source diff was not itself the failure.
- **Known exclusions:** No provider, credential, key, or deployment action ran.

## Correction and prevention

- **Correction:** Isolate Git warning output and assert the real exit status.
- **Prevention:** Do not treat known line-ending warnings as review failures.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; later exact-tip review and scoped diff checks
  passed.

## Verification and related work

The later exact-tip review completed with zero findings and the current scoped
diff check exits zero.

## Recurrence history

- 2026-08-03T19:37:35.791353Z: First observed.
- 2026-08-06T22:44:32.7354035Z: Closed after warning-isolated review evidence
  passed.
