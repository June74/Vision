# SB-20260731-034319-task3-controller-diagnostic-stray-file: Controller diagnostic created a stray script-fragment file

- **Status:** closed
- **First observed:** 2026-07-31T03:43:19.3850998Z
- **Last observed:** 2026-07-31T03:44:09.7718473Z
- **Phase/task:** Phase B Task 3 isolated controller deadline hardening
- **Environment:** Isolated controller-hardening worktree
- **Version/commit:** 2bfbc23 plus uncommitted controller hardening

## Symptom

A diagnostic quoting error created one untracked file whose filename is a
JavaScript output fragment.

## Impact

The file is outside the intended two-path controller change and must be removed
before verification or commit. Product, Git history, provider, network, and
external state were unchanged.

## Reproduction conditions

Pass an inline diagnostic fragment through shell quoting that is interpreted as
a filename rather than as executable diagnostic input.

## Safe evidence

Only filename, byte length, and modification time were inspected. File contents
were not emitted.

## Attempts and outcomes

- Git inventory identified exactly one unexpected untracked path.
- Metadata confirmed it is a small diagnostic artifact.
- No staging or commit included it.

## Cause classification

- **Confirmed cause:** Incorrect shell quoting during an isolated diagnostic.
- **Hypotheses:** None.
- **Rejected hypotheses:** The file is not an intended source, test, report, or
  evidence artifact.
- **Known exclusions:** No protected value, provider action, network request,
  or committed state is involved.

## Correction and prevention

- **Correction:** Resolve and permanently delete only the exact unexpected
  file, then prove the worktree inventory contains only the two owned paths.
- **Prevention:** Diagnostic programs must use repository scripts or
  argument-safe invocations; never embed output fragments in shell syntax.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Exact-path deletion and inventory verification.

## Verification and related work

The resolved target was proven to be inside the isolated controller worktree,
then permanently deleted by exact literal path. Git inventory now contains
only the two owned controller source/test modifications.

## Recurrence history

- 2026-07-31T03:43:19.3850998Z: First observed and contained before cleanup.
- 2026-07-31T03:44:09.7718473Z: Closed after validated exact-path deletion and
  two-path inventory verification.
