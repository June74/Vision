# SB-20260731-053524-task3-controller-path-api-compatibility: Controller preflight used an unavailable PowerShell path API

- **Status:** closed
- **First observed:** 2026-07-31T05:35:24.6016146Z
- **Last observed:** 2026-07-31T05:49:12.7453226Z
- **Phase/task:** Phase B Task 3 controller final-review repair
- **Environment:** Main Phase B worktree; delegated Windows PowerShell writer
- **Version/commit:** c5de12d

## Symptom

A read-only serialization-evidence mapper called a PowerShell path API that is
not available in this runtime.

## Impact

The controller lifecycle repair remained unstarted. No owned file, test, Git
state, provider, or external state changed.

## Reproduction conditions

Use a path helper available in a newer PowerShell or .NET runtime while running
the delegated preflight in this environment.

## Safe evidence

The writer returned one compatibility-error category and zero state changes.
No path value, source, URI, credential, protected identifier, raw argument, or
provider value was emitted.

## Attempts and outcomes

- The read-only mapper stopped at the unavailable API.
- The writer confirmed all owned files remained untouched.

## Cause classification

- **Confirmed cause:** Runtime incompatibility with the selected PowerShell
  path API.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** No repository ownership or source problem occurred.
- **Known exclusions:** No edit, test, stage, commit, provider action, or
  external mutation occurred.

## Correction and prevention

- **Correction:** Use runtime-compatible literal-path cmdlets or .NET path
  methods already confirmed in this workspace.
- **Prevention:** Avoid unverified newer PowerShell path helpers in delegated
  preflight scripts.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The writer resumed using compatible bounded reads and completed the lifecycle
repair without another path-API failure.

## Recurrence history

- 2026-07-31T05:35:24.6016146Z: First observed and contained before edits or
  tests.
- 2026-07-31T05:49:12.7453226Z: Closed after 43 focused tests, TypeScript,
  documentation coverage, and owned diff checks passed.
