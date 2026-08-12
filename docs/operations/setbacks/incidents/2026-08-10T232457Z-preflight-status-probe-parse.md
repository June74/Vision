# SB-20260810-232457-preflight-status-probe-parse

- Incident ID: `SB-20260810-232457-preflight-status-probe-parse`
- First observed: `2026-08-10T23:24:57Z`
- Last observed: `2026-08-12T18:12:44Z`
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

## Recurrence — 2026-08-12

A one-off UTC schedule calculation used the unsupported `%%` spelling for
PowerShell's remainder operator and failed before producing any values. The
first ledger patch attempt matched the wrong wrapped context and applied
nothing. A second read-only inspection call was malformed in the tool wrapper
and never executed. All commands were discarded; no file, branch, provider,
deployment, traffic, secret, key, database, or calendar state changed. Use the
single `%` operator, narrow line-exact patches, and simple bounded inspection
calls, then verify each result.

## Next step

Rerun the status audit with exact prefix checks and verify the detached
candidate worktree independently. A later bounded documentation-inspection
wrapper was also malformed before execution; it exposed nothing and changed
no state. Use simple wrapper arguments when inspecting documentation results.
