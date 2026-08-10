# SB-20260802-201243-reconnect-short-worktree-remove-partial: Short candidate worktree removal was partial

- **Status:** closed
- **First observed:** 2026-08-02T20:12:43.399004Z
- **Last observed:** 2026-08-02T23:09:52.9851982Z
- **Phase/task:** Phase B OAuth reconnect recovery Task 5 artifact correction
- **Environment:** Windows detached-artifact cleanup under the ignored local evidence directory
- **Version/commit:** generated artifact for `c1911f82c0fb274e3d50d20c3cbe82ba2abceb51`

## Symptom

Git removed the disposable short candidate registration but left its generated directory on disk.

## Impact

The LF artifact recreation is paused; the rollback artifact remains registered and untouched.

## Reproduction conditions

Remove the generated short candidate worktree after its tracked state is clean
and exact, while its offline-installed pnpm dependency tree is present.

## Safe evidence

Git removed the worktree registration but returned nonzero with the generated
directory still present. A verified PowerShell-only recursive retry then
reached a deep dependency metadata path and returned the fixed local category
`DirectoryNotFoundException` while the orphan remained.

## Attempts and outcomes

- Exact target containment, candidate identity, and zero tracked residue were
  proved before removal.
- Git removed the registration but left generated files.
- Ordinary PowerShell recursive deletion partially reduced the orphan and then
  failed at a deep dependency path.

## Cause classification

- **Confirmed cause:** Windows ordinary path handling cannot reliably traverse
  every pnpm dependency path in the generated directory during recursive
  cleanup.
- **Hypotheses:** None remaining. The Windows extended-length path form removed
  the exact orphan successfully.
- **Rejected hypotheses:** The target is not still registered and contains no
  tracked candidate change.
- **Known exclusions:** No source, commit, provider, database, credential, or
  deployment state changed. The rollback artifact was later removed only after
  its exact identity and zero tracked residue were re-proved.

## Correction and prevention

- **Correction:** Delete only the already-verified orphan with .NET's
  extended-length Windows path form, then prove both path absence and absent
  worktree registration.
- **Prevention:** Artifact cleanup on Windows must account for deep generated
  pnpm paths; validate and use one exact extended-length target when ordinary
  Git cleanup leaves an unregistered directory.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

Closed after the verified extended-length deletion removed the unregistered
candidate orphan. The rollback dependency tree was then removed through the
same exact-path mechanism before Git cleanly removed its registered worktree.
A fresh read-only check proves both short paths absent and both worktree
registrations absent. Both artifacts remain exactly reproducible from their
immutable commits.

## Recurrence history

- 2026-08-02T20:12:43.399004Z: First observed.
- 2026-08-02T20:13:16.0557141Z: Ordinary PowerShell deletion hit the same deep
  package-path boundary; the exact extended-length correction was selected.
- 2026-08-02T20:22:54.7307690Z: Closed after both short generated paths and
  both registrations were proved absent.
- 2026-08-02T23:08:58.3953731Z: Recurred during the plan-required cleanup of
  the recreated short rollback artifact. Git removed the exact registration
  and `.git` link, then returned a filename-length error with only the
  generated dependency tree still on disk. The candidate and main worktrees,
  provider state, and project sources were untouched. The previously verified
  extended-length exact-path correction is required for this unregistered
  orphan.
- 2026-08-02T23:09:52.9851982Z: Closed after the exact contained,
  unregistered, no-`.git` orphan was removed with the verified Windows
  extended-length path mechanism. Fresh checks returned both path absence and
  registration absence as true.
