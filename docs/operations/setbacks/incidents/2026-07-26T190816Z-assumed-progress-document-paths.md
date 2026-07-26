# SB-20260726-190816-assumed-progress-document-paths: Progress document paths were assumed

- **Status:** closed
- **First observed:** 2026-07-26T19:08:16.577518Z
- **Last observed:** 2026-07-26T19:08:56.5870529Z
- **Phase/task:** Phase B completion audit
- **Environment:** Local Phase B worktree
- **Version/commit:** `1dff60e`

## Symptom

A read-only progress search included two guessed filenames that are not present even though the repository listing contained the authoritative names.

## Impact

No file changed; the completion audit paused until searches were restricted to listed files.

## Reproduction conditions

Search guessed singular progress and live-acceptance filenames instead of using
the names returned by the immediately preceding directory listing.

## Safe evidence

The authoritative listing contains `phase-b-progress-simple.md`,
`phase-b-progress-technical.md`, and the numbered recovery/release plan.

## Attempts and outcomes

- The guessed-file search failed safely.
- The listed filenames were then opened successfully.

## Cause classification

- **Confirmed cause:** The search command ignored the authoritative filenames
  it had just obtained.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** The progress documents were present and unchanged.

## Correction and prevention

- **Correction:** Used only filenames returned by the repository listing.
- **Prevention:** Resolve a file from actual directory output before adding it
  to a multi-file read.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

Both progress records and the numbered recovery/release plan were found and
read.

## Recurrence history

- 2026-07-26T19:08:16.577518Z: First observed.
