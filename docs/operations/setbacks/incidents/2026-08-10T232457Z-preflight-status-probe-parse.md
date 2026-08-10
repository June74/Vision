# SB-20260810-232457-preflight-status-probe-parse

- Incident ID: `SB-20260810-232457-preflight-status-probe-parse`
- First observed: `2026-08-10T23:24:57Z`
- Last observed: `2026-08-10T23:24:57Z`
- Status: `contained`
- Phase/task: Phase B docs-freeze preflight
- Environment: Windows PowerShell, linked Phase B worktree
- Version/commit: `499f4ac1`

## Symptom

Two read-only probes were malformed. A status counter used PowerShell's `-like`
wildcard where a literal `StartsWith('??')` test was required, and a separate
candidate-worktree status expression omitted a closing parenthesis.

## Impact

The first counts were invalid and were discarded. No file, branch, provider,
deployment, traffic, secret, key, database, or calendar state changed.

## Cause classification

- **Confirmed cause:** PowerShell wildcard semantics and a local expression
  construction typo.
- **Rejected hypotheses:** The remote push and worktree state were not changed
  by either probe.

## Correction and prevention

Use literal string predicates for porcelain status prefixes and run each
PowerShell expression through a syntax-safe bounded command before using its
counts as evidence.

## Next step

Rerun the status audit with exact prefix checks and verify the detached
candidate worktree independently.
