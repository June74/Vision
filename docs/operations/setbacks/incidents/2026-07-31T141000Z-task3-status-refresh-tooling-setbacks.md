# SB-20260731-141000-task3-status-refresh-tooling-setbacks: Status refresh used an unsupported UTC switch

- **Status:** closed
- **First observed:** 2026-07-31T14:10:00Z
- **Last observed:** 2026-07-31T14:11:03.5905501Z
- **Phase/task:** Phase B Task 3 status refresh and setback-ledger maintenance
- **Environment:** Main Phase B worktree; Windows PowerShell
- **Version/commit:** c5de12d plus unstaged Task 3 repair

## Symptom

While recording a separately tracked truncated-output recurrence,
`Get-Date -AsUTC` failed because this PowerShell version does not support the
`-AsUTC` parameter.

## Impact

The status refresh paused before repository inspection. No source, provider,
credential, identifier, live resource, or external state changed.

## Reproduction conditions

Invoke `Get-Date -AsUTC` in this Windows PowerShell version.

## Safe evidence

The shell returned only the unsupported-parameter category. No environment
value, URI, credential, protected identifier, provider data, or runtime stream
was emitted.

## Attempts and outcomes

- The unsupported invocation exited before producing a timestamp.
- `[DateTime]::UtcNow.ToString('o')` returned the UTC timestamp safely.

## Cause classification

- **Confirmed cause:** This PowerShell version does not implement the
  `Get-Date -AsUTC` switch.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** No clock, permission, repository, or provider
  failure occurred.
- **Known exclusions:** No mutation occurred beyond this incident record.

## Correction and prevention

- **Correction:** Use the .NET UTC clock API in this environment.
- **Prevention:** Do not use PowerShell-version-specific date switches without
  confirming availability.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The replacement UTC clock call succeeded, and bounded exact-file reads proved
the earlier ledger patch had applied.

## Recurrence history

- 2026-07-31T14:10:00Z: First observed and contained before repository
  inspection.
- 2026-07-31T14:11:03.5905501Z: Closed after the compatible UTC call and
  bounded ledger verification succeeded.
