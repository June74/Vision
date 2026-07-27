# SB-20260727-013001-guessed-release-checklist-file: Release checklist filename was guessed

- **Status:** closed
- **First observed:** 2026-07-27T01:30:01Z
- **Last observed:** 2026-07-27T01:30:01Z
- **Phase/task:** Phase B completion audit
- **Environment:** Local worktree
- **Version/commit:** `a433912`

## Symptom

A combined read-only audit command ended nonzero after probing for a
`release-checklist.md` file that is not present.

## Impact

The existing recovery plan and cost evidence were still read. No repository or
provider state changed.

## Cause classification

- **Confirmed cause:** The optional filename was guessed instead of being
  discovered from the repository.
- **Known exclusions:** The authoritative Phase B recovery plan and evidence
  map exist and were not affected.

## Correction and prevention

- **Correction:** Use the named recovery-release plan and `phase-b-evidence.md`
  as the completion sources.
- **Prevention:** Discover optional documents by listing or search before
  reading a presumed filename.

## Verification and related work

The authoritative plan supplied the complete remaining gate list.

